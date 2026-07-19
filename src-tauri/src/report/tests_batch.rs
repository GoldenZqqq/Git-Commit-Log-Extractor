#[test]
    fn batch_file_name_formats_default_template() {
        let daily = SubPeriod {
            start: "2026-07-01".into(),
            end: "2026-07-01".into(),
            label: "2026-07-01".into(),
            report_kind: "daily".into(),
        };
        let context = BatchFileNameContext {
            period: &daily,
            author: "Alice",
            project: "全部项目",
        };
        assert_eq!(
            batch_file_name(DEFAULT_BATCH_FILE_NAME_TEMPLATE, "markdown", context).unwrap(),
            "2026-07-01-日报.md"
        );
        assert_eq!(
            batch_file_name(DEFAULT_BATCH_FILE_NAME_TEMPLATE, "docx", context).unwrap(),
            "2026-07-01-日报.docx"
        );

        let weekly = SubPeriod {
            start: "2026-06-29".into(),
            end: "2026-07-05".into(),
            label: "2026-W27".into(),
            report_kind: "weekly".into(),
        };
        assert_eq!(
            batch_file_name(
                DEFAULT_BATCH_FILE_NAME_TEMPLATE,
                "pdf",
                BatchFileNameContext {
                    period: &weekly,
                    author: "Alice",
                    project: "全部项目",
                },
            )
            .unwrap(),
            "2026-W27-周报.pdf"
        );

        let custom = SubPeriod {
            start: "2026-07-01".into(),
            end: "2026-07-31".into(),
            label: "2026-07-01~2026-07-31".into(),
            report_kind: "custom".into(),
        };
        assert_eq!(
            batch_file_name(
                DEFAULT_BATCH_FILE_NAME_TEMPLATE,
                "markdown",
                BatchFileNameContext {
                    period: &custom,
                    author: "Alice",
                    project: "全部项目",
                },
            )
            .unwrap(),
            "2026-07-01~2026-07-31-自定义报告.md"
        );
    }

    #[test]
    fn batch_file_name_renders_tokens_and_sanitizes_values() {
        let weekly = SubPeriod {
            start: "2026-06-29".into(),
            end: "2026-07-05".into(),
            label: "2026-W27".into(),
            report_kind: "weekly".into(),
        };
        let template = "{period}_{date}_{week}_{month}_{author}_{project}_{type}.{ext}";
        let name = batch_file_name(
            template,
            "pdf",
            BatchFileNameContext {
                period: &weekly,
                author: "Alice/研发:负责人",
                project: "平台|核心",
            },
        )
        .unwrap();

        assert_eq!(
            "2026-W27_2026-06-29_2026-W27_2026-06_Alice_研发_负责人_平台_核心_周报.pdf",
            name
        );
    }

    #[test]
    fn batch_file_name_rejects_invalid_templates() {
        let daily = SubPeriod {
            start: "2026-07-01".into(),
            end: "2026-07-01".into(),
            label: "2026-07-01".into(),
            report_kind: "daily".into(),
        };
        let context = BatchFileNameContext {
            period: &daily,
            author: "Alice",
            project: "全部项目",
        };

        assert!(
            batch_file_name("{period}-{unknown}.{ext}", "markdown", context)
                .unwrap_err()
                .contains("未知变量")
        );
        assert!(batch_file_name("{period}-{type}", "markdown", context)
            .unwrap_err()
            .contains("{ext}"));
    }

    #[test]
    fn normalize_batch_export_formats_requires_values_and_deduplicates() {
        assert!(normalize_batch_export_formats(&[]).is_err());
        assert_eq!(
            vec!["md", "pdf"],
            normalize_batch_export_formats(&[
                "markdown".to_string(),
                "pdf".to_string(),
                "md".to_string(),
            ])
            .unwrap()
        );
    }

    #[test]
    fn reserve_batch_file_name_avoids_existing_and_batch_collisions() {
        let dir = std::env::temp_dir().join(format!("gitpulse-batch-name-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("report.md"), "existing").unwrap();
        let mut used = HashSet::new();

        assert_eq!(
            "report-2.md",
            reserve_batch_file_name(&dir.to_string_lossy(), "report.md", &mut used)
        );
        assert_eq!(
            "report-3.md",
            reserve_batch_file_name(&dir.to_string_lossy(), "report.md", &mut used)
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn supplemental_items_append_user_facts_without_changing_existing_report() {
        let output = append_supplemental_items(
            "# 日报\n\n- 完成 Git 功能",
            &[
                "  参与支付联调并确认回退路径  ".to_string(),
                "".to_string(),
                "完成上线后验证".to_string(),
            ],
            &ReportRedactionOptions::default(),
        )
        .unwrap();

        assert!(output.starts_with("# 日报\n\n- 完成 Git 功能"));
        assert!(output.contains("## 用户补充事项（非 Git）"));
        assert!(output.contains("- 参与支付联调并确认回退路径"));
        assert!(output.contains("- 完成上线后验证"));
    }

    #[test]
    fn supplemental_items_apply_redaction_and_reject_oversized_payloads() {
        let redaction = ReportRedactionOptions {
            enabled: true,
            rules: vec![ReportRedactionRule {
                find: "内部项目".to_string(),
                replacement: "项目A".to_string(),
            }],
        };
        let output =
            append_supplemental_items("# 周报", &["参与内部项目联调".to_string()], &redaction)
                .unwrap();

        assert!(output.contains("参与项目A联调"));
        assert!(!output.contains("内部项目"));
        assert!(append_supplemental_items(
            "# 周报",
            &vec!["事项".to_string(); 21],
            &ReportRedactionOptions::default(),
        )
        .unwrap_err()
        .contains("最多"));
        assert!(append_supplemental_items(
            "# 周报",
            &["字".repeat(201)],
            &ReportRedactionOptions::default(),
        )
        .unwrap_err()
        .contains("200"));
    }
