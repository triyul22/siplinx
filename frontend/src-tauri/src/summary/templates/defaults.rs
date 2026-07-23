/// Embedded default templates using compile-time inclusion
///
/// These templates are bundled into the binary and serve as fallbacks
/// when custom templates are not available.

/// Планёрка - general team meeting (decisions/tasks/discussion). Default fallback.
pub const PLANERKA: &str = include_str!("../../../templates/planerka.json");

/// Лекция / обучение - material-focused (theses/concepts/takeaways), not meeting-shaped.
pub const LECTURE: &str = include_str!("../../../templates/lecture.json");

/// Брейншторминг - idea generation (ideas/selected directions/next steps).
pub const BRAINSTORM: &str = include_str!("../../../templates/brainstorm.json");

/// Клиентская / Sales встреча.
pub const SALES_CLIENT: &str = include_str!("../../../templates/sales_marketing_client_call.json");

/// Daily standup template for engineering/product teams
pub const DAILY_STANDUP: &str = include_str!("../../../templates/daily_standup.json");

/// Standard meeting notes template
pub const STANDARD_MEETING: &str = include_str!("../../../templates/standard_meeting.json");

/// Registry of all built-in templates
///
/// Maps template identifiers to their embedded JSON content
pub fn get_builtin_templates() -> Vec<(&'static str, &'static str)> {
    vec![
        ("planerka", PLANERKA),
        ("lecture", LECTURE),
        ("brainstorm", BRAINSTORM),
        ("sales_marketing_client_call", SALES_CLIENT),
        ("daily_standup", DAILY_STANDUP),
        ("standard_meeting", STANDARD_MEETING),
    ]
}

/// Get a built-in template by identifier
///
/// # Arguments
/// * `id` - Template identifier (e.g., "planerka", "lecture", "daily_standup")
///
/// # Returns
/// The template JSON content if found, None otherwise
pub fn get_builtin_template(id: &str) -> Option<&'static str> {
    match id {
        "planerka" => Some(PLANERKA),
        "lecture" => Some(LECTURE),
        "brainstorm" => Some(BRAINSTORM),
        "sales_marketing_client_call" => Some(SALES_CLIENT),
        "daily_standup" => Some(DAILY_STANDUP),
        "standard_meeting" => Some(STANDARD_MEETING),
        _ => None,
    }
}

/// List all built-in template identifiers
pub fn list_builtin_template_ids() -> Vec<&'static str> {
    vec![
        "planerka",
        "lecture",
        "brainstorm",
        "sales_marketing_client_call",
        "daily_standup",
        "standard_meeting",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_templates_valid_json() {
        for (id, content) in get_builtin_templates() {
            let result = serde_json::from_str::<serde_json::Value>(content);
            assert!(
                result.is_ok(),
                "Built-in template '{}' contains invalid JSON: {:?}",
                id,
                result.err()
            );
        }
    }

    #[test]
    fn test_get_builtin_template() {
        assert!(get_builtin_template("daily_standup").is_some());
        assert!(get_builtin_template("standard_meeting").is_some());
        assert!(get_builtin_template("nonexistent").is_none());
    }
}
