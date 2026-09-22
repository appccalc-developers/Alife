# 虚拟成员关联清单

来源：当前 EF migration snapshot；这是结构清单，不代表生产环境已有这些记录。
清理脚本另行扫描目标数据库的实际外键、所有 GUID 列及文本中的 ID，输出实际命中行和阻断项。
本表覆盖 Member 外键与按 MemberId 命名的逻辑引用；其他命名、JSON、外部缓存以运行检查为准。

共 124 个成员引用字段，涉及 80 张表。

| 表 | 字段 | EF 删除规则／引用类型 |
|---|---|---|
| `albums` | `created_by_member_id` | 逻辑引用（无 Member 外键） |
| `announcements` | `created_by_member_id` | Restrict |
| `application_history` | `actor_member_id` | Restrict |
| `audit_logs` | `actor_member_id` | Restrict |
| `audit_logs` | `target_member_id` | Restrict |
| `bible_reading_progresses` | `member_id` | 逻辑引用（无 Member 外键） |
| `church_person_applications` | `applicant_member_id` | Restrict |
| `church_person_applications` | `identity_verified_by_member_id` | 逻辑引用（无 Member 外键） |
| `church_person_applications` | `linked_member_id` | Restrict |
| `contact_inquiries` | `submitted_by_member_id` | Restrict |
| `contact_profiles` | `member_id` | Restrict |
| `content_posts` | `created_by_member_id` | Restrict |
| `event_activity_template_versions` | `created_by_member_id` | Restrict |
| `event_approval_decisions` | `actor_member_id` | Restrict |
| `event_artifacts` | `approved_by_member_id` | Restrict |
| `event_artifacts` | `created_by_member_id` | Restrict |
| `event_composition_occurrences` | `execution_confirmed_by_member_id` | Restrict |
| `event_composition_series` | `created_by_member_id` | Restrict |
| `event_enrollments` | `member_id` | Restrict |
| `event_fact_sets` | `created_by_member_id` | Restrict |
| `event_module_report_actions` | `actor_member_id` | 逻辑引用（无 Member 外键） |
| `event_module_report_revisions` | `author_member_id` | 逻辑引用（无 Member 外键） |
| `event_module_reports` | `updated_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_operations_roster_assignments` | `assigned_by_member_id` | Restrict |
| `event_operations_roster_assignments` | `member_id` | Restrict |
| `event_operations_roster_availability` | `member_id` | Restrict |
| `event_operations_task_blockers` | `created_by_member_id` | Restrict |
| `event_operations_task_blockers` | `resolved_by_member_id` | Restrict |
| `event_operations_tasks` | `assigned_member_id` | Restrict |
| `event_operations_tasks` | `reviewer_member_id` | Restrict |
| `event_operations_team_members` | `invited_by_member_id` | Restrict |
| `event_operations_team_members` | `member_id` | Restrict |
| `event_package_approval_delegations` | `delegated_to_member_id` | Restrict |
| `event_package_approval_delegations` | `granted_by_member_id` | Restrict |
| `event_package_approval_delegations` | `revoked_by_member_id` | Restrict |
| `event_package_conditions` | `satisfied_by_member_id` | Restrict |
| `event_package_conditions` | `verified_by_member_id` | Restrict |
| `event_package_decisions` | `actor_member_id` | Restrict |
| `event_package_governance_policy_versions` | `published_by_member_id` | Restrict |
| `event_packages` | `generated_by_member_id` | Restrict |
| `event_packages` | `submitted_by_member_id` | Restrict |
| `event_plan_snapshots` | `accepted_by_member_id` | Restrict |
| `event_preparation_reopen_requests` | `requested_by_member_id` | Restrict |
| `event_preparation_reopen_requests` | `reviewed_by_member_id` | Restrict |
| `event_program_items` | `owner_member_id` | Restrict |
| `event_ram_actions` | `actor_member_id` | 逻辑引用（无 Member 外键） |
| `event_ram_assessments` | `approved_by_member_id` | Restrict |
| `event_ram_assessments` | `author_member_id` | 逻辑引用（无 Member 外键） |
| `event_ram_assessments` | `submitted_by_member_id` | Restrict |
| `event_ram_assessments` | `sync_reviewed_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_ram_policy_versions` | `created_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_ram_policy_versions` | `published_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_ram_revisions` | `author_member_id` | 逻辑引用（无 Member 外键） |
| `event_ram_revisions` | `onsite_member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_actions` | `actor_member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_applications` | `created_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_applications` | `organiser_member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_materials` | `uploaded_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_participants` | `consent_recorded_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_participants` | `guardian_member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_participants` | `member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_policies` | `fee_approved_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_registration_policies` | `fee_submitted_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_resource_venue_reservations` | `released_by_member_id` | Restrict |
| `event_resource_venue_reservations` | `reserved_by_member_id` | Restrict |
| `event_resource_venues` | `created_by_member_id` | Restrict |
| `event_reviews` | `member_id` | Restrict |
| `event_role_assignments` | `assigned_by_member_id` | Restrict |
| `event_role_assignments` | `member_id` | Restrict |
| `event_roster_defaults` | `created_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_safeguarding_authorised_collectors` | `revoked_by_member_id` | Restrict |
| `event_safeguarding_child_attendance` | `checked_in_by_member_id` | Restrict |
| `event_safeguarding_child_attendance` | `checked_out_by_member_id` | Restrict |
| `event_safeguarding_child_consents` | `recorded_by_member_id` | Restrict |
| `event_safeguarding_child_registrations` | `child_member_id` | Restrict |
| `event_safeguarding_child_registrations` | `created_by_member_id` | Restrict |
| `event_safeguarding_child_registrations` | `ended_by_member_id` | Restrict |
| `event_safeguarding_configurations` | `configured_by_member_id` | Restrict |
| `event_safeguarding_guardian_relationships` | `created_by_member_id` | Restrict |
| `event_safeguarding_guardian_relationships` | `guardian_member_id` | Restrict |
| `event_safeguarding_policy_versions` | `created_by_member_id` | Restrict |
| `event_safeguarding_worker_eligibility` | `member_id` | Restrict |
| `event_safeguarding_worker_eligibility` | `verified_by_member_id` | Restrict |
| `event_sessions` | `lead_member_id` | Restrict |
| `event_task_approval_actions` | `actor_member_id` | 逻辑引用（无 Member 外键） |
| `event_task_approval_actions` | `reviewer_member_id` | 逻辑引用（无 Member 外键） |
| `event_travel_drivers` | `member_id` | Restrict |
| `event_travel_drivers` | `verified_by_member_id` | Restrict |
| `event_travel_journeys` | `created_by_member_id` | Restrict |
| `event_travel_passenger_assignments` | `assigned_by_member_id` | Restrict |
| `event_travel_passenger_assignments` | `ended_by_member_id` | Restrict |
| `event_travel_passenger_assignments` | `member_id` | Restrict |
| `event_travel_vehicles` | `verified_by_member_id` | Restrict |
| `event_venue_booking_exceptions` | `actor_member_id` | 逻辑引用（无 Member 外键） |
| `event_venue_weekly_bookings` | `created_by_member_id` | 逻辑引用（无 Member 外键） |
| `event_workflow_steps` | `assigned_member_id` | Restrict |
| `event_workflow_steps` | `completed_by_member_id` | Restrict |
| `event_workflow_templates` | `created_by_member_id` | Restrict |
| `event_zones` | `lead_member_id` | Restrict |
| `file_assets` | `owner_member_id` | Restrict |
| `forum_comments` | `author_member_id` | Restrict |
| `forum_posts` | `author_member_id` | Restrict |
| `forum_posts` | `last_comment_member_id` | Restrict |
| `group_events` | `accountable_owner_member_id` | Restrict |
| `group_events` | `created_by_member_id` | Restrict |
| `group_events` | `execution_confirmed_by_member_id` | Restrict |
| `group_events` | `published_by_member_id` | Restrict |
| `group_events` | `registration_opened_by_member_id` | Restrict |
| `group_join_invites` | `created_by_member_id` | Restrict |
| `group_membership_applications` | `applicant_member_id` | Restrict |
| `group_memberships` | `member_id` | Cascade |
| `member_activation_invitations` | `issued_by_member_id` | Restrict |
| `member_activation_invitations` | `member_id` | Restrict |
| `member_passkey_credentials` | `member_id` | Cascade |
| `member_platform_roles` | `assigned_by_member_id` | Restrict |
| `member_platform_roles` | `member_id` | Cascade |
| `notification_messages` | `created_by_member_id` | Restrict |
| `notification_messages` | `recipient_member_id` | Restrict |
| `page_publication_reviews` | `published_by_member_id` | Restrict |
| `page_publication_reviews` | `reviewed_by_member_id` | Restrict |
| `page_publication_reviews` | `submitted_by_member_id` | Restrict |
| `pages` | `created_by_member_id` | Restrict |
| `passkey_ceremonies` | `member_id` | Restrict |
| `visit_contact_requests` | `handled_by_member_id` | Restrict |

间接依赖由运行时外键检查覆盖；允许自动清理的个人附属链及保留策略见 [操作说明](cleanup-demo-members.md)。
