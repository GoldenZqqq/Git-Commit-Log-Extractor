fn titles(items: &[ProjectCommitItem]) -> Vec<&str> {
        items.iter().map(|item| item.title.as_str()).collect()
    }

    fn commit(project_name: &str, branch_name: &str, message: &str) -> CommitRecord {
        commit_by_author(project_name, branch_name, message, "tester")
    }

    fn commit_by_author(
        project_name: &str,
        branch_name: &str,
        message: &str,
        author: &str,
    ) -> CommitRecord {
        CommitRecord {
            repo_path: project_name.to_string(),
            project_name: project_name.to_string(),
            branch_name: branch_name.to_string(),
            hash: "abc123def".to_string(),
            author: author.to_string(),
            author_email: format!("{}@example.com", author.to_lowercase()),
            date: "2026-06-10 10:00:00 +0800".to_string(),
            message: message.to_string(),
            additions: 0,
            deletions: 0,
            changed_files: 0,
        }
    }

    #[test]
    fn split_daily_single_day() {
        let periods = split_date_range("2026-07-01", "2026-07-01", "daily").unwrap();
        assert_eq!(periods.len(), 1);
        assert_eq!(periods[0].start, "2026-07-01");
        assert_eq!(periods[0].end, "2026-07-01");
        assert_eq!(periods[0].report_kind, "daily");
    }

    #[test]
    fn split_daily_week() {
        let periods = split_date_range("2026-07-01", "2026-07-07", "daily").unwrap();
        assert_eq!(periods.len(), 7);
        assert_eq!(periods[0].label, "2026-07-01");
        assert_eq!(periods[6].label, "2026-07-07");
    }

    #[test]
    fn split_custom_keeps_the_complete_selected_range() {
        let periods = split_date_range("2026-07-01", "2026-07-31", "custom").unwrap();

        assert_eq!(1, periods.len());
        assert_eq!("2026-07-01", periods[0].start);
        assert_eq!("2026-07-31", periods[0].end);
        assert_eq!("2026-07-01~2026-07-31", periods[0].label);
        assert_eq!("custom", periods[0].report_kind);
    }

    #[test]
    fn split_weekly_cross_month() {
        let periods = split_date_range("2026-06-25", "2026-07-15", "weekly").unwrap();
        assert!(periods.len() >= 3);
        assert_eq!(periods[0].report_kind, "weekly");
        assert!(periods[0].start <= periods[0].end);
        assert!(periods.last().unwrap().end == "2026-07-15");
    }

    #[test]
    fn split_monthly_cross_year() {
        let periods = split_date_range("2026-11-15", "2027-02-10", "monthly").unwrap();
        assert_eq!(periods.len(), 4);
        assert_eq!(periods[0].label, "2026-11");
        assert_eq!(periods[0].start, "2026-11-15");
        assert_eq!(periods[0].end, "2026-11-30");
        assert_eq!(periods[3].label, "2027-02");
        assert_eq!(periods[3].start, "2027-02-01");
        assert_eq!(periods[3].end, "2027-02-10");
    }

    #[test]
    fn split_rejects_start_after_end() {
        let result = split_date_range("2026-07-10", "2026-07-01", "daily");
        assert!(result.is_err());
    }

    #[test]
    fn split_rejects_too_many_periods() {
        let result = split_date_range("2024-01-01", "2026-12-31", "daily");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("超过上限"));
    }
