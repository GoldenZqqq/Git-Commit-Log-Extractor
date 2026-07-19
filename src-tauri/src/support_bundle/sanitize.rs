use regex::{Regex, RegexBuilder};
use std::collections::HashSet;
use std::sync::OnceLock;

const REDACTED: &str = "<redacted>";

pub struct Sanitizer {
    known_patterns: Vec<Regex>,
}

impl Sanitizer {
    pub fn new(values: Vec<String>) -> Self {
        let mut seen = HashSet::new();
        let mut values = values
            .into_iter()
            .map(|value| value.trim().to_string())
            .filter(|value| value.chars().count() >= 3)
            .filter(|value| seen.insert(value.to_lowercase()))
            .collect::<Vec<_>>();
        values.sort_by_key(|value| std::cmp::Reverse(value.len()));
        let known_patterns = values
            .into_iter()
            .filter_map(|value| {
                RegexBuilder::new(&regex::escape(&value))
                    .case_insensitive(true)
                    .build()
                    .ok()
            })
            .collect();
        Self { known_patterns }
    }

    pub fn sanitize(&self, value: &str, max_chars: usize) -> String {
        let bounded = truncate_chars(value, max_chars.saturating_mul(4).max(max_chars));
        let mut sanitized = normalize_controls(&bounded);
        for pattern in &self.known_patterns {
            sanitized = pattern.replace_all(&sanitized, REDACTED).into_owned();
        }
        sanitized = bearer_regex()
            .replace_all(&sanitized, "Bearer <redacted>")
            .into_owned();
        sanitized = assignment_regex()
            .replace_all(&sanitized, "$1=<redacted>")
            .into_owned();
        sanitized = provider_token_regex()
            .replace_all(&sanitized, REDACTED)
            .into_owned();
        sanitized = sk_token_regex()
            .replace_all(&sanitized, REDACTED)
            .into_owned();
        sanitized = jwt_regex().replace_all(&sanitized, REDACTED).into_owned();
        sanitized = email_regex()
            .replace_all(&sanitized, "<email>")
            .into_owned();
        sanitized = windows_path_regex()
            .replace_all(&sanitized, REDACTED)
            .into_owned();
        sanitized = unix_path_regex()
            .replace_all(&sanitized, "$1<redacted>")
            .into_owned();
        truncate_chars(&sanitized, max_chars)
    }

    pub fn sanitize_line(&self, value: &str, max_chars: usize) -> String {
        let sanitized = self.sanitize(value, max_chars);
        let single_line = sanitized.split_whitespace().collect::<Vec<_>>().join(" ");
        truncate_chars(&single_line, max_chars)
    }
}

fn normalize_controls(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character == '\n' || character == '\t' || !character.is_control() {
                character
            } else {
                ' '
            }
        })
        .collect()
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let mut bounded = chars.by_ref().take(max_chars).collect::<String>();
    if chars.next().is_some() && max_chars >= 3 {
        bounded.truncate(
            bounded
                .char_indices()
                .nth(max_chars.saturating_sub(3))
                .map(|(index, _)| index)
                .unwrap_or(bounded.len()),
        );
        bounded.push_str("...");
    }
    bounded
}

fn bearer_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+").expect("Bearer regex must be valid")
    })
}

fn assignment_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r#"(?i)\b(api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|proxy[_-]?password|proxy[_-]?username|username)\s*[:=]\s*["']?[^,\s;，；"']+"#,
        )
        .expect("credential assignment regex must be valid")
    })
}

fn provider_token_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r"(?i)\b(?:gh[opusr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|ya29\.[A-Za-z0-9._-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})\b",
        )
        .expect("provider token regex must be valid")
    })
}

fn sk_token_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"(?i)\bsk-[A-Za-z0-9_-]{8,}\b").expect("API key regex must be valid")
    })
}

fn jwt_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")
            .expect("JWT regex must be valid")
    })
}

fn email_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b")
            .expect("email regex must be valid")
    })
}

fn windows_path_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r#"(?i)(?:[a-z]:[\\/]|\\\\)[^\r\n<>"|?*;,，；]+"#)
            .expect("Windows path regex must be valid")
    })
}

fn unix_path_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r"(?m)(^|[\s(:：=])(/[^\r\n,，;；)）]+)").expect("Unix path regex must be valid")
    })
}
