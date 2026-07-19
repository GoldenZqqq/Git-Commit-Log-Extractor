fn project_names_from(
        projects: &[crate::project_retrospective::ReportHistoryProject],
    ) -> Vec<&str> {
        projects
            .iter()
            .map(|project| project.name.as_str())
            .collect()
    }

    #[test]
    fn render_weekly_report_uses_custom_template_variables() {
        let commits = vec![
            commit("repo-a", "main", "feat: 添加格式模板"),
            commit("repo-b", "main", "fix: 修复模板预览"),
        ];
        let template =
            "# {periodLabel}\n项目 {projectCount} / 提交 {commitCount}\n\n{projectSections}";

        let report = render_weekly_report_with_template(
            &commits,
            &HashMap::new(),
            "2026-06-08",
            "2026-06-14",
            "tester",
            "2026-W24",
            false,
            "mapped-project",
            &[],
            template,
        );

        assert!(report.contains("# 2026年第24周"));
        assert!(report.contains("项目 2 / 提交 2"));
        assert!(report.contains("### repo-a(main)"));
        assert!(report.contains("- 添加格式模板"));
        assert!(!report.contains("## 一、本周重点"));
    }

    #[test]
    fn render_weekly_report_groups_all_authors_by_author_then_project() {
        let commits = vec![
            commit_by_author("repo-a", "main", "feat: 完成团队周报", "Alice"),
            commit_by_author("repo-b", "main", "fix: 修复导出异常", "Bob"),
        ];

        let report = render_weekly_report_with_template(
            &commits,
            &HashMap::new(),
            "2026-06-08",
            "2026-06-14",
            "",
            "2026-W24",
            false,
            "mapped-project",
            &[],
            default_template_for("weekly"),
        );

        assert!(report.contains("- 作者：全部作者"));
        assert!(report.contains("### Alice"));
        assert!(report.contains("#### repo-a(main)"));
        assert!(report.contains("- 完成团队周报"));
        assert!(report.contains("### Bob"));
        assert!(report.contains("#### repo-b(main)"));
        assert!(report.contains("- 修复导出异常"));
    }

    #[test]
    fn render_daily_report_groups_multi_author_commit_items() {
        let commits = vec![
            commit_by_author("repo-a", "main", "feat: 汇总前端日报", "Alice"),
            commit_by_author("repo-a", "main", "fix: 修复后端日报", "Bob"),
        ];
        let templates = ReportFormatTemplates::default();

        let report = render_extract_report(
            &commits,
            &HashMap::new(),
            false,
            "mapped-project",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );

        assert!(report.contains("### Alice"));
        assert!(report.contains("#### repo-a(main)"));
        assert!(report.contains("- 汇总前端日报"));
        assert!(report.contains("### Bob"));
        assert!(report.contains("- 修复后端日报"));
    }

    #[test]
    fn render_extract_report_uses_daily_and_custom_templates_separately() {
        let commits = vec![commit("repo-a", "main", "feat: 接入自定义输出")];
        let templates = ReportFormatTemplates {
            daily: "日报 {periodLabel}\n{commitItems}".to_string(),
            custom: "自定义 {periodLabel}\n{projectCount}/{commitCount}\n{projectSections}"
                .to_string(),
            ..ReportFormatTemplates::default()
        };

        let daily = render_extract_report(
            &commits,
            &HashMap::new(),
            false,
            "mapped-project",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );
        let custom = render_extract_report(
            &commits,
            &HashMap::new(),
            false,
            "mapped-project",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-01",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "双周同步",
                report_kind: "custom",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );

        assert!(daily.contains("日报 2026-06-14"));
        assert!(daily.contains("接入自定义输出"));
        assert!(custom.contains("自定义 双周同步"));
        assert!(custom.contains("1/1"));
        assert!(custom.contains("### repo-a(main)"));
    }

    #[test]
    fn render_daily_commit_items_can_use_mapped_project_without_repo_branch() {
        let commits = vec![commit(
            "cse-frontend",
            "master",
            "feat: 接入注安题目纠错反馈模块",
        )];
        let mut project_names = HashMap::new();
        project_names.insert("cse-frontend(*)".to_string(), "柏科注安工程师".to_string());
        let templates = ReportFormatTemplates {
            daily: "{commitItems}".to_string(),
            ..ReportFormatTemplates::default()
        };

        let mapped_only = render_extract_report(
            &commits,
            &project_names,
            false,
            "mapped-project",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );
        let repo_and_mapped = render_extract_report(
            &commits,
            &project_names,
            true,
            "repo-branch-and-mapped",
            false,
            &ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );

        assert!(mapped_only.contains("柏科注安工程师 - 接入注安题目纠错反馈模块"));
        assert!(!mapped_only.contains("cse-frontend(master)"));
        assert!(repo_and_mapped
            .contains("cse-frontend(master) - 柏科注安工程师 - 接入注安题目纠错反馈模块"));
    }

    #[test]
    fn build_extract_result_keeps_template_when_detailed_output_is_enabled() {
        let commits = vec![commit("repo-a", "main", "feat: 保留详细日志")];
        let templates = ReportFormatTemplates {
            daily: "模板正文\n{commitItems}".to_string(),
            ..ReportFormatTemplates::default()
        };

        let result = build_extract_result(
            Vec::new(),
            commits,
            Vec::new(),
            &HashMap::new(),
            false,
            "mapped-project",
            false,
            true,
            &ReportRedactionOptions::default(),
            ExtractReportFormat {
                start_date: "2026-06-14",
                end_date: "2026-06-14",
                author: "tester",
                period_label: "",
                report_kind: "daily",
                evidence_link_rules: &[],
                templates: &templates,
            },
        );

        assert!(result.detailed_text.starts_with("模板正文"));
        assert!(result.detailed_text.contains("## 详细日志"));
        assert!(result.detailed_text.contains("Message: feat: 保留详细日志"));
    }

    #[test]
    fn clean_commit_message_strips_conventional_scope_prefix() {
        // 复现：带 scope 的 Conventional Commits 前缀应被整体剥离，
        // 不能让 `refactor(examuserprofile):` 之类残留进日报。
        assert_eq!(
            clean_commit_message("refactor(examuserprofile): 学习基础改用数据字典绑定"),
            "学习基础改用数据字典绑定"
        );
        // 无 scope 的既有行为保持不变（向后兼容）。
        assert_eq!(
            clean_commit_message("feat: 支持报告模板自定义输出"),
            "支持报告模板自定义输出"
        );
        // scope 大小写混合、含空格也一并处理。
        assert_eq!(
            clean_commit_message("fix(ExamUser): 修复字典绑定空指针"),
            "修复字典绑定空指针"
        );
    }

    #[test]
    fn clean_commit_message_strips_leading_bom_before_prefix() {
        // 复现：部分编辑器在提交信息行首写入 BOM（U+FEFF），顶在 `feat:` 前，
        // 使前缀正则从行首匹配失败，导致 `feat:` 残留进报告。剥掉后应正常清理。
        assert_eq!(
            clean_commit_message("\u{feff}feat: 优化课程包关联课程交互与抽屉面板展宽"),
            "优化课程包关联课程交互与抽屉面板展宽"
        );
        // 零宽空格（U+200B）等其他前导零宽字符同样处理。
        assert_eq!(
            clean_commit_message("\u{200b}fix(ExamUser): 修复字典绑定空指针"),
            "修复字典绑定空指针"
        );
    }

    #[test]
    fn clean_commit_message_reuses_regexes_for_large_commit_batches() {
        let started_at = std::time::Instant::now();

        for _ in 0..10_000 {
            let cleaned = clean_commit_message("feat(benchmark): normalize  commit - evidence");
            std::hint::black_box(cleaned);
        }

        assert!(
            started_at.elapsed() < std::time::Duration::from_secs(5),
            "10k commit messages should not recompile regexes per item"
        );
    }

    #[test]
    fn report_helpers_scale_to_large_unique_batches() {
        let items = (0..10_000)
            .map(|index| ProjectCommitItem {
                title: format!("item-{index}"),
                evidence: String::new(),
                additions: 0,
                deletions: 0,
                changed_files: 0,
            })
            .collect::<Vec<_>>();
        let started_at = std::time::Instant::now();

        assert_eq!(10_000, unique_items(&items).len());
        for _ in 0..10_000 {
            std::hint::black_box(extract_evidence_references("feat: ABC-12 PR #34 and #56"));
        }

        assert!(
            started_at.elapsed() < std::time::Duration::from_secs(5),
            "large report batches should use cached regexes and linear dedupe"
        );
    }

    #[test]
    fn unique_items_preserves_the_first_seen_item_and_order() {
        let items = vec![
            ProjectCommitItem {
                title: "first".to_string(),
                evidence: "original".to_string(),
                additions: 1,
                deletions: 0,
                changed_files: 1,
            },
            ProjectCommitItem {
                title: "second".to_string(),
                evidence: String::new(),
                additions: 2,
                deletions: 0,
                changed_files: 1,
            },
            ProjectCommitItem {
                title: "first".to_string(),
                evidence: "duplicate".to_string(),
                additions: 3,
                deletions: 0,
                changed_files: 1,
            },
        ];

        let unique = unique_items(&items);

        assert_eq!(vec!["first", "second"], titles(&unique));
        assert_eq!("original", unique[0].evidence);
    }
