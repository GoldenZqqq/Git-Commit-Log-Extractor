fn format_evidence_text(commit: &CommitRecord, evidence_link_rules: &[EvidenceLinkRule]) -> String {
    let mut lines = vec![format!(
        "来源：`{}` / `{}` / `{}` / `{}`",
        inline_code_text(&commit.project_name),
        inline_code_text(&commit.branch_name),
        inline_code_text(&short_date(&commit.date)),
        inline_code_text(&short_hash(&commit.hash))
    )];
    lines.push(format!(
        "原始：`{}`",
        inline_code_text(&compact_message(&commit.message))
    ));
    let references = format_evidence_references(&commit.message, evidence_link_rules);
    if !references.is_empty() {
        lines.push(format!("关联：{}", references.join("、")));
    }
    lines.join("\n")
}

fn format_evidence_block(
    commit: &CommitRecord,
    evidence_link_rules: &[EvidenceLinkRule],
) -> String {
    format_evidence_text(commit, evidence_link_rules)
        .lines()
        .map(|line| format!("  > {}", line))
        .collect::<Vec<_>>()
        .join("\n")
}

#[derive(Debug, Clone)]
struct EvidenceReference {
    label: String,
    prefix: String,
    id: String,
    key: String,
    position: usize,
}

fn format_evidence_references(
    message: &str,
    evidence_link_rules: &[EvidenceLinkRule],
) -> Vec<String> {
    extract_evidence_references(message)
        .iter()
        .map(|reference| render_evidence_reference(reference, evidence_link_rules))
        .collect()
}

fn extract_evidence_references(message: &str) -> Vec<EvidenceReference> {
    let compact = compact_message(message);
    let mut references = Vec::new();
    let mut seen = HashSet::new();

    for captures in pr_reference_regex().captures_iter(&compact) {
        if let Some(id) = captures.get(1) {
            let position = captures
                .get(0)
                .map(|value| value.start())
                .unwrap_or(usize::MAX);
            push_evidence_reference(
                &mut references,
                &mut seen,
                "PR",
                id.as_str(),
                &format!("PR #{}", id.as_str()),
                &format!("PR-{}", id.as_str()),
                position,
            );
        }
    }

    for captures in hash_reference_regex().captures_iter(&compact) {
        let Some(reference_match) = captures.get(0) else {
            continue;
        };
        if hash_belongs_to_pr_reference(&compact, reference_match.start()) {
            continue;
        }
        if let Some(id) = captures.get(1) {
            push_evidence_reference(
                &mut references,
                &mut seen,
                "#",
                id.as_str(),
                &format!("#{}", id.as_str()),
                &format!("#{}", id.as_str()),
                reference_match.start(),
            );
        }
    }

    for captures in key_reference_regex().captures_iter(&compact) {
        let (Some(prefix), Some(id), Some(label)) =
            (captures.get(1), captures.get(2), captures.get(0))
        else {
            continue;
        };
        push_evidence_reference(
            &mut references,
            &mut seen,
            prefix.as_str(),
            id.as_str(),
            label.as_str(),
            label.as_str(),
            label.start(),
        );
    }

    references.sort_by_key(|reference| reference.position);
    references
}

fn push_evidence_reference(
    references: &mut Vec<EvidenceReference>,
    seen: &mut HashSet<String>,
    prefix: &str,
    id: &str,
    label: &str,
    key: &str,
    position: usize,
) {
    let dedupe_key = format!("{}:{}", prefix.to_ascii_uppercase(), id);
    if !seen.insert(dedupe_key) {
        return;
    }
    references.push(EvidenceReference {
        label: label.to_string(),
        prefix: prefix.to_string(),
        id: id.to_string(),
        key: key.to_string(),
        position,
    });
}

fn hash_belongs_to_pr_reference(message: &str, hash_start: usize) -> bool {
    message
        .get(..hash_start)
        .unwrap_or_default()
        .trim_end()
        .rsplit(|ch: char| !ch.is_ascii_alphanumeric())
        .find(|part| !part.is_empty())
        .is_some_and(|part| part.eq_ignore_ascii_case("PR"))
}

fn render_evidence_reference(
    reference: &EvidenceReference,
    evidence_link_rules: &[EvidenceLinkRule],
) -> String {
    let Some(rule) = evidence_link_rules
        .iter()
        .find(|rule| same_evidence_prefix(&rule.prefix, &reference.prefix))
    else {
        return reference.label.clone();
    };
    let url = build_evidence_reference_url(rule, reference);
    if url.is_empty() {
        reference.label.clone()
    } else {
        format!("[{}]({})", reference.label, url)
    }
}

fn same_evidence_prefix(left: &str, right: &str) -> bool {
    left.trim().eq_ignore_ascii_case(right.trim())
}

fn build_evidence_reference_url(rule: &EvidenceLinkRule, reference: &EvidenceReference) -> String {
    rule.url_template
        .trim()
        .replace("{id}", &reference.id)
        .replace("{key}", &reference.key)
        .replace("{prefix}", &reference.prefix)
}

fn short_date(date: &str) -> String {
    date.split_whitespace().next().unwrap_or(date).to_string()
}

fn short_hash(hash: &str) -> String {
    project_retrospective::short_evidence_id(hash)
}

fn compact_message(message: &str) -> String {
    whitespace_regex()
        .replace_all(message.trim(), " ")
        .to_string()
}

fn pr_reference_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"(?i)\bPR\s*#(\d+)\b").expect("PR regex must be valid"))
}

fn hash_reference_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"#(\d+)\b").expect("hash regex must be valid"))
}

fn key_reference_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"\b([A-Z][A-Z0-9]{1,9})-(\d+)\b").expect("key regex must be valid")
    })
}

fn inline_code_text(value: &str) -> String {
    value.replace('`', "'")
}
