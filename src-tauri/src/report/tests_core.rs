    #[test]
    fn previous_month_handles_year_boundary() {
        let date = NaiveDate::from_ymd_opt(2026, 1, 5).unwrap();
        let range = previous_month_range_from(date);
        assert_eq!(
            ("2025-12-01".into(), "2025-12-31".into(), "2025-12".into()),
            range
        );
    }

    #[test]
    fn save_report_file_rejects_missing_output_dir_with_actionable_message() {
        let missing = std::env::temp_dir().join("gitpulse-missing-output-dir-for-test");
        let _ = fs::remove_dir_all(&missing);

        let message =
            save_report_file(&missing.to_string_lossy(), "report.md", "content").unwrap_err();

        assert!(message.contains("输出目录不存在"));
        assert!(message.contains("重新选择"));
    }

    #[test]
    fn save_report_file_rejects_file_as_output_dir() {
        let path =
            std::env::temp_dir().join(format!("gitpulse-output-file-{}", std::process::id()));
        fs::write(&path, "not a dir").unwrap();

        let message =
            save_report_file(&path.to_string_lossy(), "report.md", "content").unwrap_err();

        assert!(message.contains("不是文件夹"));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn save_report_document_writes_docx_package() {
        let dir = std::env::temp_dir().join(format!("gitpulse-docx-export-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        let path = save_report_document(
            &dir.to_string_lossy(),
            "weekly_report_2026-W25",
            "# 周报\n\n- 完成 `DOCX` 导出",
            "docx",
        )
        .unwrap();
        let bytes = fs::read(&path).unwrap();
        let text = String::from_utf8_lossy(&bytes);

        assert!(path.ends_with("weekly_report_2026-W25.docx"));
        assert_eq!(&bytes[0..2], b"PK");
        assert!(text.contains("word/document.xml"));
        assert!(text.contains("DOCX"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_report_document_preserves_markdown_export() {
        let dir = std::env::temp_dir().join(format!("gitpulse-md-export-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        let path = save_report_document(&dir.to_string_lossy(), "daily.md", "content", "markdown")
            .unwrap();
        let content = fs::read_to_string(&path).unwrap();

        assert!(path.ends_with("daily.md"));
        assert_eq!("content", content);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn save_report_document_writes_pdf_file() {
        let dir = std::env::temp_dir().join(format!("gitpulse-pdf-export-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();

        let path = save_report_document(
            &dir.to_string_lossy(),
            "weekly_report_2026-W25.md",
            "# Weekly Report\n\n- Export PDF",
            "pdf",
        )
        .unwrap();
        let bytes = fs::read(&path).unwrap();

        assert!(path.ends_with("weekly_report_2026-W25.pdf"));
        assert!(bytes.starts_with(b"%PDF"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn render_weekly_report_uses_project_mapping_and_week_title() {
        let commits = vec![commit("repo-a", "main", "feat: 添加周报功能")];
        let mut project_names = HashMap::new();
        project_names.insert("repo-a(*)".to_string(), "研发平台-".to_string());

        let report = render_weekly_report_with_template(
            &commits,
            &project_names,
            "2026-06-08",
            "2026-06-14",
            "tester",
            "2026-W24",
            false,
            "mapped-project",
            &[],
            default_template_for("weekly"),
        );

        assert!(report.contains("# 2026年第24周工作周报"));
        assert!(report.contains("### 研发平台"));
        assert!(report.contains("- 提交事项：1"));
        assert!(report.contains("添加周报功能"));
        assert!(report.contains("## 三、下周关注"));
    }

    #[test]
    fn render_reports_can_include_commit_evidence_details() {
        let commits = vec![commit("repo-a", "feature/report", "feat: 添加证据详情")];
        let report = render_weekly_report_with_template(
            &commits,
            &HashMap::new(),
            "2026-06-08",
            "2026-06-14",
            "tester",
            "2026-W24",
            true,
            "mapped-project",
            &[],
            default_template_for("weekly"),
        );

        assert!(report.contains("- 添加证据详情"));
        assert!(report.contains("  > 来源：`repo-a` / `feature/report` / `2026-06-10` / `abc123d`"));
        assert!(report.contains("  > 原始：`feat: 添加证据详情`"));
    }

    #[test]
    fn render_reports_link_issue_references_in_evidence_details() {
        let commits = vec![commit(
            "repo-a",
            "feature/report",
            "feat: 对齐工单证据 #123 PR #456 JIRA-789 GH-321",
        )];
        let rules = vec![
            EvidenceLinkRule {
                prefix: "#".to_string(),
                url_template: "https://github.com/org/repo/issues/{id}".to_string(),
            },
            EvidenceLinkRule {
                prefix: "PR".to_string(),
                url_template: "https://github.com/org/repo/pull/{id}".to_string(),
            },
            EvidenceLinkRule {
                prefix: "JIRA".to_string(),
                url_template: "https://jira.example.com/browse/{key}".to_string(),
            },
            EvidenceLinkRule {
                prefix: "GH".to_string(),
                url_template: "https://github.com/org/repo/issues/{id}".to_string(),
            },
        ];

        let report = render_weekly_report_with_template(
            &commits,
            &HashMap::new(),
            "2026-06-08",
            "2026-06-14",
            "tester",
            "2026-W24",
            true,
            "mapped-project",
            &rules,
            default_template_for("weekly"),
        );

        assert!(report.contains(
            "关联：[#123](https://github.com/org/repo/issues/123)、[PR #456](https://github.com/org/repo/pull/456)、[JIRA-789](https://jira.example.com/browse/JIRA-789)、[GH-321](https://github.com/org/repo/issues/321)"
        ));
    }

    #[test]
    fn render_weekly_report_redacts_traceable_evidence_details() {
        let commits = vec![commit(
            "private-api",
            "feature/customer-secret",
            "feat: 完成内部项目客户验收 #123",
        )];
        let mut project_names = HashMap::new();
        project_names.insert("private-api(*)".to_string(), "内部平台-".to_string());
        let evidence_link_rules = vec![EvidenceLinkRule {
            prefix: "#".to_string(),
            url_template: "https://jira.internal/browse/{id}".to_string(),
        }];
        let redaction = ReportRedactionOptions {
            enabled: true,
            rules: vec![
                ReportRedactionRule {
                    find: "内部项目".to_string(),
                    replacement: "项目A".to_string(),
                },
                ReportRedactionRule {
                    find: "客户".to_string(),
                    replacement: String::new(),
                },
            ],
        };

        let report = render_weekly_report_with_redaction(
            &commits,
            &project_names,
            "2026-06-08",
            "2026-06-14",
            "tester@example.com",
            "2026-W24",
            true,
            "mapped-project",
            &evidence_link_rules,
            default_template_for("weekly"),
            &redaction,
        );

        assert!(report.contains("来源：`仓库1` / `分支1` / `2026-06-10` / `commit-1`"));
        assert!(report.contains("项目A***验收"));
        assert!(report.contains("- 作者：作者范围已脱敏"));
        assert!(!report.contains("private-api"));
        assert!(!report.contains("feature/customer-secret"));
        assert!(!report.contains("abc123def"));
        assert!(!report.contains("tester@example.com"));
        assert!(!report.contains("https://jira.internal"));
        assert!(!report.contains("内部平台"));
        assert!(!report.contains("内部项目"));
    }

    #[test]
    fn report_history_projects_reuse_mapping_and_redact_before_persistence() {
        let mut commits = vec![
            commit("private-api", "main", "feat: exact mapping"),
            commit("private-api", "feature/report", "feat: wildcard mapping"),
        ];
        commits[0].hash = "abc123def".to_string();
        commits[1].hash = "def456abc".to_string();
        let project_names = HashMap::from([
            ("private-api(main)".to_string(), "核心平台-".to_string()),
            ("private-api(*)".to_string(), "内部平台_".to_string()),
        ]);

        let projects = build_report_history_projects(
            &commits,
            &project_names,
            &ReportRedactionOptions::default(),
        );
        assert_eq!(vec!["内部平台", "核心平台"], project_names_from(&projects));
        assert_eq!(vec!["def456a"], projects[0].evidence_ids);
        assert_eq!(vec!["abc123d"], projects[1].evidence_ids);

        let redacted = build_report_history_projects(
            &commits,
            &project_names,
            &ReportRedactionOptions {
                enabled: true,
                rules: Vec::new(),
            },
        );
        assert_eq!(
            vec!["仓库1(分支1)", "仓库1(分支2)"],
            project_names_from(&redacted)
        );
        assert_eq!(vec!["commit-1"], redacted[0].evidence_ids);
        assert_eq!(vec!["commit-2"], redacted[1].evidence_ids);
        assert!(!format!("{redacted:?}").contains("private-api"));
    }
