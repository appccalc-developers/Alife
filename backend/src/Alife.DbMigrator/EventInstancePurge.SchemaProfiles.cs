using System.Globalization;
using System.Text;

namespace Alife.DbMigrator;

internal sealed partial class EventInstancePurge
{
    private static readonly IReadOnlySet<string> RequiredReviewedTables =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "dbo.group_events",
            "dbo.event_activity_template_versions"
        };

    // These hashes were reviewed against isolated SQL Server databases migrated to
    // 20260915101331 (the 67-model deployment), 20261011113522 (the 75-model
    // preparation deployment), and 20261012225333 (the Event 2.0 post-reset model).
    // Each hash covers every column (name/type/length/precision/scale/nullability/
    // ordinal/PK ordinal) and every outbound FK (name, ordered columns, target,
    // disabled/trusted state). A table may be absent because the production models
    // did not all ship the same optional Event features; any present table must be
    // byte-for-byte one of the reviewed shapes for the selected coherent profile.
    private static IReadOnlyList<ReviewedSchemaProfile> ReviewedSchemaProfiles =>
    [
        new("legacy-67", Legacy67Shapes),
        new("legacy-75", Legacy75Shapes),
        new("event-2.0", Event20Shapes)
    ];

    private static readonly IReadOnlyDictionary<string, string> Legacy67Shapes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["dbo.audit_logs"] = "fd89bc7e8a31ce8f0fdcd8d79517cb5200ec720a2e8b41a85216a3e07325042f",
            ["dbo.event_activity_plans"] = "94ce165f5225aecaac46b04ad1f12a458b17d4b6925f87a911b5a030eee96146",
            ["dbo.event_activity_template_versions"] = "762587c1d1b7a0576931254372ea8ad545d9b0cbcf6110ac826eb4338f3491e9",
            ["dbo.event_approval_decisions"] = "ee852d416c7d325f0330106fdc2d7006ee7e5e0013dca1f339591c4b683fc883",
            ["dbo.event_artifacts"] = "bf8fa6fa830f910c5874af696ecf527f31db4938fd93889c05ccecced920643e",
            ["dbo.event_composition_occurrences"] = "92f0992b06c0b2c8bcebeb1bfb1c9bf241d3f4bc58106e89779ce21911846ec3",
            ["dbo.event_composition_series"] = "6615a39b09c2e8f17eccbc1b0c16c0e7e8e883b4d87162537d8f328fd484da03",
            ["dbo.event_contact_profiles"] = "88ab1e6aaffe0ad01a67beeb1b6d5f8cef5272c6305e6fd8a4f110feec14858a",
            ["dbo.event_enrollment_history"] = "77e302f168cee94674c3e58e0dfad04ce2bf036ebae860292d78ff2db5255836",
            ["dbo.event_enrollments"] = "5f0e6f8fe9a04edb5de430e74fb4dfdae567efe45d8f1736cacb24d80fdb150c",
            ["dbo.event_fact_sets"] = "b87761c5b970980abb5698e8a8c9a1e427fe353c322428687234df3c8b5607fa",
            ["dbo.event_idempotency_records"] = "4e333e9198283e3c86fdc1f80ed237ce7add679b3e302c5245e3f0b4f3f4f281",
            ["dbo.event_module_report_actions"] = "646b81588edfdefc7e98f1eeac23c4f6b0c754ef92d12824232eb6521ff7da7e",
            ["dbo.event_module_report_revisions"] = "1b3d0a1fe3bdf2cd7707fd08e6763cac9a8a63f7aebb7f28be56a06ad1e69f87",
            ["dbo.event_module_reports"] = "75cec6deb87f684b1828b0bcb8204be41d217b5fd8408d5bde9801c64f44b042",
            ["dbo.event_operations_roster_assignments"] = "53aff5317c0cea79cadffa7db85003cdf8139d36d803b822f4d553bdd7ecdf0f",
            ["dbo.event_operations_roster_availability"] = "cdcc8f1ca81bd608e32d094b5761cfa3747435b981225cd20b5c47ebe0786214",
            ["dbo.event_operations_task_blockers"] = "52cc33ef794d48ea47b1eac094e1cd313c98b5031e2d5e3d598525719d6d4da5",
            ["dbo.event_operations_task_dependencies"] = "ca02aaa3cc82f9c7b65e48475d94d4051f6b59d62885c393c73e5f294b9e2e16",
            ["dbo.event_operations_tasks"] = "98a748745e8fa82f5f4210adf08cb333ffbd3e0e9805ca582f0ef2baa70d30ea",
            ["dbo.event_operations_team_members"] = "9bff7e1a81c7b239fb2d625354f654b78c11a0f99dfe1f687a98557fd593c2a2",
            ["dbo.event_package_approval_delegations"] = "9fc4aecc0e9e40549dd7315b81cc822ae661bf16caeaf646fc7c5d60690af0fd",
            ["dbo.event_package_conditions"] = "0698e8eb9b0d9d368ed61c5b08c3af3ef2f3343e6c8e2df83e2cc09343b2a505",
            ["dbo.event_package_decisions"] = "15abd8f6a5e11c55ac79f0efeb97f23e940d7260d67bebc5a723501f95b48424",
            ["dbo.event_package_governance_policy_versions"] = "0b90fdef36081b6adc3b4c11d1ee4154c702738754a1dee6cb2b219dead94cb5",
            ["dbo.event_package_source_references"] = "748d0983d9ae328575510c360360779439ec3b2065253fd4ade2e851db15d887",
            ["dbo.event_packages"] = "fbda46ec234c0b06e1a8d9ff9aa272d00c3455bec065f582962ef26edd98bd5c",
            ["dbo.event_plan_snapshots"] = "3db6200cdbc4a094b10b4372c3af04e381aee3c5c76d28012b444b2e82b2fcf6",
            ["dbo.event_preparation_reopen_requests"] = "c202c3094808c92d81267ecda8f4a0fea6a68c756148b6df2f0a6a0b8cc89979",
            ["dbo.event_program_items"] = "f575f99ff7294a063896dc03c5bd8abe55cbf2fbf446d87e713972f0c03ff610",
            ["dbo.event_ram_actions"] = "eda5e017d13525a8fe840c5d3888b29e2e514596fa0dbcae21a286411aa41143",
            ["dbo.event_ram_assessments"] = "5b02b2fb3e4037b6206d008802e2595fa6b91fd185c13b06ff1131b5e9f9632d",
            ["dbo.event_ram_policy_versions"] = "a765913e8210ccd30504fe2280c95bf1a080d7b7ce40e16aeea58ba826e7084d",
            ["dbo.event_ram_revisions"] = "5d897464e89f520b0d5482bd54c0c34e2395eeadddcd72a2d42ae263c2340024",
            ["dbo.event_registration_actions"] = "84d62fbcddf32dc5e0f5bc2bae06763b857cb37cbcd8938222b03a44e03afded",
            ["dbo.event_registration_applications"] = "ef7697d72d55bd676f2e4d720e81961632ffb0df9d04c6f173dd720090335364",
            ["dbo.event_registration_materials"] = "51a0074209c45136e42e6f15e8ae7c29380726e92b8aebb23eae21da8e8d8c37",
            ["dbo.event_registration_participants"] = "bdce42a9108c5291922f18bcb440a47e1a9a0938d6e02def5eab11822b5e22b5",
            ["dbo.event_registration_policies"] = "d6ff919ff7a6ae8fcd4a5e763a098b6bfbb5c039bf8a4827ea2775e20f54738c",
            ["dbo.event_resource_venue_reservations"] = "a9fc32a8a5b2954223a8accab9b6f112c2f3f22c93becfc684abbf4a894eaf25",
            ["dbo.event_resource_venues"] = "672ca90fc01b7d5ec3cf2298a7aaccaf9b3ed08cbea99a32f6ebf7fdef4f5390",
            ["dbo.event_reviews"] = "1d75721b2233d68996a3a8e6a4cba99c6fc9a7e9e663a95c2765b7ba220f7156",
            ["dbo.event_role_assignments"] = "84da462bcaf337ea384761de6b2de9a1c05a0b9945af4a2fd03cfa345b784172",
            ["dbo.event_roster_defaults"] = "85259132fad0bfde6cdd9118f891f92b870b13582c034839a2729a4573469472",
            ["dbo.event_roster_groups"] = "e8d8b4ac3f199d206fd9cca8b89bfd0ee930dacc23a22789288ccdf5b3adce96",
            ["dbo.event_safeguarding_authorised_collectors"] = "bd7215918fa4bcd1a3267604ad554127c0a5a1af9d56477e67d228fac142a975",
            ["dbo.event_safeguarding_child_attendance"] = "04f25bf8a4eb335410ce8b7e7b6152e4779e85985d601f93f0166a93fe2c7b58",
            ["dbo.event_safeguarding_child_consents"] = "30218ff7302052421060c1d02f2aadcdbab4dd1da9e98a49592eed7807c3781c",
            ["dbo.event_safeguarding_child_registrations"] = "a3b3be3036a4915ad3da2ebd35e23fcd3eeb1879129aadb9583fa0f1cba9df75",
            ["dbo.event_safeguarding_configurations"] = "44e007a69668da9910ce86d02ecb933ba29cebe927ab743d75bbf6311abea0a4",
            ["dbo.event_safeguarding_guardian_relationships"] = "a1340bee4b949c5a8b65af614b9202feb5b5951a81b175c225a14149dbace8e2",
            ["dbo.event_safeguarding_policy_versions"] = "bec1aa3581e74ef3d7d108c4011286bf896b774ea352b301ea9946fda12c2531",
            ["dbo.event_safeguarding_worker_eligibility"] = "9996b3f37df863e85abd951482f9f2c683eb04fd95a934d9c9dfd1c2843dac92",
            ["dbo.event_service_slots"] = "3dfdd981e8d592638140e8e646aca1bc2f5dae6b18b6d2a3e7e92b03602f7d25",
            ["dbo.event_sessions"] = "001e8a018b93344741664754c92a8d70d21f9a444cd61815e818288b1a4dfae7",
            ["dbo.event_task_approval_actions"] = "0ba257bec30d680e173c8180459caa47436534a8c4a8ee30ca271980c2f40e27",
            ["dbo.event_travel_drivers"] = "26ab963cb146133994f2120f66a0e59563778a44ad2f17deefeffb00e342cbf0",
            ["dbo.event_travel_journeys"] = "5d00aeb11f15304f5b743a41efa578a4acf066846b4dbffb6c9b8439f8f321fa",
            ["dbo.event_travel_passenger_assignments"] = "d2c611ff73c80662da6d67f985ffb2239a22d365ba608d5759ed0ecad0792ecf",
            ["dbo.event_travel_pickup_stops"] = "592cec6bc0d38687d80cc43a67a06345ad3b38e174898ed7e9b5cd309864a95d",
            ["dbo.event_travel_vehicles"] = "06b0ae480265d7afdaae5996e516c9c64e664b844b2842c18bac954a0009b80d",
            ["dbo.event_venue_booking_exceptions"] = "0856e2ef88c1725495b74a181010d26878a0b86b4b44ea4c17ae2d6c09359644",
            ["dbo.event_venue_weekly_bookings"] = "0e7afa951828b7693ea944efd525e6c34e0bba1d7ecb274618abb5f0055e2a93",
            ["dbo.event_workflow_runs"] = "947b01769cb8d1f3dc49dae70858bac2bc7e06fcae4db52690e09b4067c3e704",
            ["dbo.event_workflow_steps"] = "2ffebaab1d438c79bd593e29ddd8dc16886e9596336dfccae52f4ee301b86e81",
            ["dbo.event_workflow_templates"] = "40e6dd712c73f78e2ccca564870a9e490ea7bcaf079dea2692d3b25d8956d64d",
            ["dbo.event_zones"] = "a588a4c46bf28d29e247d4704a1e8f5ad09afa88278d7a8a0742a3930b19dbae",
            ["dbo.file_assets"] = "fc5f077620a80392137cfb222ec127030e401d648c874b124840e8902b2a2593",
            ["dbo.group_events"] = "2648cd18ee3180ec037a6710d4b8ccd11ffa5b37d6ad0482688c305020a90f20",
            ["dbo.notification_messages"] = "93566eb0daa593ca59067bbd87af3d25c4a69ec851ff090cb45a71685e310a13"
        };

    private static readonly IReadOnlyDictionary<string, string> Legacy75Shapes = Overlay(
        Legacy67Shapes,
        additionsOrOverrides: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["dbo.event_activity_consents"] = "dde3b7e6ad74b8a836174438cdd3d23547ea1b483be0ba8c1d9dcc45bf3c4d6e",
            ["dbo.event_activity_module_configurations"] = "940977b526daef67a06b06ee37bcbd016224d20c64568f6ce551b413eb92bc34",
            ["dbo.event_activity_offers"] = "b06613e3272a0060345b45f70b2085c1ea5e9d010b5707c772187656c0e7b839",
            ["dbo.event_activity_participations"] = "a740cc8ca740d224094c5e17579ba0548fbf37daf632fcd81ab28431f72138b0",
            ["dbo.event_activity_payments"] = "d4702d396484740c31006a16df33d4fe10f2e7fec686940c856556abeb5f0b87",
            ["dbo.event_activity_policy_versions"] = "1a1c5addca5e297a8a2a893f40e31c65c8ff37c7910f575ddb09c3bee8f3bca4",
            ["dbo.event_activity_space_requests"] = "a6b5ea9948c25fe4286686eca0efc7fe26d2e8b237cd59d4a56bf4814f3eca8e",
            ["dbo.event_activity_template_versions"] = "5d5089e25ad89a3550cfaeb6ce6b0ea9f505e2ec0265797f2a015968c707bdb6",
            ["dbo.event_participant_private_data"] = "30e4d66d9efbfa86df3103e4e794969dec6417a12ac891d8997944243bce0293",
            ["dbo.event_safeguarding_child_registrations"] = "0c30aeab0e8bc2136f6a73852e69e82c90ab7f998326749a06e202743da97b5e"
        });

    private static readonly IReadOnlyDictionary<string, string> Event20Shapes = Overlay(
        Legacy75Shapes,
        removals:
        [
            "dbo.event_artifacts",
            "dbo.event_enrollment_history",
            "dbo.event_enrollments",
            "dbo.event_workflow_runs",
            "dbo.event_workflow_steps"
        ],
        additionsOrOverrides: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["dbo.event_composition_occurrences"] = "90561a5ce5cbb314ab934545937fea851ffb1cee21cd1cdade56bbf2ee33fd97",
            ["dbo.event_fact_sets"] = "6d0b8930b76b5c794f4b6dbc517f167ba26908f3cb29fb028c9b289fd3003718",
            ["dbo.event_operations_tasks"] = "2c952851aa86b98b99f8a81955d7062f8097ea4b9e223ecf8f54d7b783694a5c",
            ["dbo.event_plan_snapshots"] = "f2ae6d27c4b7ee2fee2652b56f51ec87aa4e1ba404024aee4d574dd91d5e1690",
            ["dbo.event_registration_applications"] = "3749532828b896253084311fa4c4206a6ebb32e2da036f2cfe9fc04c6f85a185",
            ["dbo.event_registration_participants"] = "79433a27803baa0baa1a4a9050f32cbae26f2c8796b7d327892639517dfd1f51",
            ["dbo.event_safeguarding_child_registrations"] = "d6ff9f780a6c87a207be4d55f88c267ec5cdbc0f3657e46445d6c89a3c8457d9",
            // The Event 2.0 migration removes only collaboration_version (ordinal 37)
            // from this table. The resulting live shape was checked against the
            // reviewed legacy-75 hash with that one column restored in memory.
            ["dbo.group_events"] = "bde6c4d72e4be1f8e606e9a042ff3f96cf55222514213a7b759224254751a21b"
        });

    // The existing local database followed an older column-allocation history.
    // Its group_events has the same columns, types, nullability and FK mappings
    // as a fresh Event 2.0 database; SQL Server column_id values after 11 are
    // two higher because two former columns left gaps. Accept this exact shape
    // for the explicitly local purge only, without relaxing production profiles.
    private static readonly ReviewedSchemaProfile LocalEvent20SparseColumns = new(
        "event-2.0-local-sparse-columns",
        Overlay(Event20Shapes, additionsOrOverrides: new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["dbo.group_events"] = "d6bd03cd45633a045f7d00d6f2e4210413814ae8935a01870783f4a4ff974ba3"
        }));

    private static IReadOnlyDictionary<string, string> Overlay(
        IReadOnlyDictionary<string, string> source,
        IReadOnlyCollection<string>? removals = null,
        IReadOnlyDictionary<string, string>? additionsOrOverrides = null)
    {
        var result = new Dictionary<string, string>(source, StringComparer.OrdinalIgnoreCase);
        foreach (var removal in removals ?? []) result.Remove(removal);
        foreach (var addition in additionsOrOverrides ?? new Dictionary<string, string>())
            result[addition.Key] = addition.Value;
        return result;
    }

    private static string MatchReviewedSchemaProfile(DatabaseMetadata metadata, bool allowLocalSparseColumns = false)
    {
        var profiles = allowLocalSparseColumns
            ? ReviewedSchemaProfiles.Append(LocalEvent20SparseColumns).ToArray()
            : ReviewedSchemaProfiles;
        var liveTables = metadata.Tables.Values
            .Where(IsReviewedSchemaTable)
            .OrderBy(table => table.QualifiedName, StringComparer.Ordinal)
            .ToArray();
        var liveShapes = liveTables.ToDictionary(
            table => table.QualifiedName,
            table => CalculateReviewedTableShapeHash(metadata, table),
            StringComparer.OrdinalIgnoreCase);

        var matches = profiles.Where(profile =>
                RequiredReviewedTables.All(required => liveShapes.ContainsKey(required)) &&
                liveShapes.All(live => profile.TableShapes.TryGetValue(live.Key, out var expected) &&
                                       FixedTimeEquals(expected, live.Value)))
            .OrderByDescending(profile => profile.TableShapes.Count)
            .ToArray();
        if (matches.Length != 0)
            return matches[0].Name;

        var nearest = profiles
            .Select(profile => new
            {
                profile.Name,
                MismatchedTables = liveShapes.Where(live =>
                        !profile.TableShapes.TryGetValue(live.Key, out var expected) ||
                        !FixedTimeEquals(expected, live.Value))
                    .Select(live => live.Key)
                    .Concat(RequiredReviewedTables.Where(required => !liveShapes.ContainsKey(required)))
                    .OrderBy(name => name, StringComparer.Ordinal)
                    .ToArray()
            })
            .OrderBy(candidate => candidate.MismatchedTables.Length)
            .First();
        var evidence = Sha256(string.Join("\n", liveShapes.OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => pair.Key.ToLowerInvariant() + "=" + pair.Value)));
        throw new InvalidOperationException(
            $"The live Event schema does not match a reviewed reset profile " +
            $"(nearest={nearest.Name}; mismatches={nearest.MismatchedTables.Length}; " +
            $"tables={string.Join(",", nearest.MismatchedTables)}; " +
            $"shapes={string.Join(",", nearest.MismatchedTables.Select(name => liveShapes.TryGetValue(name, out var hash) ? hash : "missing"))}; " +
            $"schemaEvidence={evidence}).");
    }

    private static bool IsReviewedSchemaTable(TableInfo table) =>
        KnownInstanceTables.Contains(table.Name) || PreservedEventTables.Contains(table.Name) ||
        SpecialEventTables.Contains(table.Name) || KnownSoftReferenceTables.Contains(table.Name);

    private static string CalculateReviewedTableShapeHash(DatabaseMetadata metadata, TableInfo table)
        => Sha256(BuildReviewedTableShapeCanonical(metadata, table));

    private static string BuildReviewedTableShapeCanonical(DatabaseMetadata metadata, TableInfo table)
    {
        var canonical = new StringBuilder();
        foreach (var column in table.Columns.Values.OrderBy(column => column.Ordinal))
        {
            canonical.Append("c|")
                .Append(column.Name.ToLowerInvariant()).Append('|')
                .Append(column.TypeName.ToLowerInvariant()).Append('|')
                .Append(column.MaxLength.ToString(CultureInfo.InvariantCulture)).Append('|')
                .Append(column.Precision.ToString(CultureInfo.InvariantCulture)).Append('|')
                .Append(column.Scale.ToString(CultureInfo.InvariantCulture)).Append('|')
                .Append(column.IsNullable ? '1' : '0').Append('|')
                .Append(column.Ordinal.ToString(CultureInfo.InvariantCulture)).Append('|')
                .Append(column.PrimaryKeyOrdinal.ToString(CultureInfo.InvariantCulture)).Append('\n');
        }

        foreach (var foreignKey in metadata.ForeignKeys
                     .Where(foreignKey => foreignKey.DependentTable.Equals(table.QualifiedName, StringComparison.OrdinalIgnoreCase))
                     .OrderBy(foreignKey => foreignKey.Name, StringComparer.Ordinal))
        {
            for (var index = 0; index < foreignKey.DependentColumns.Count; index++)
            {
                canonical.Append("f|")
                    .Append(foreignKey.Name.ToLowerInvariant()).Append('|')
                    .Append(foreignKey.PrincipalTable.ToLowerInvariant()).Append('|')
                    .Append(foreignKey.DependentColumns[index].ToLowerInvariant()).Append('|')
                    .Append(foreignKey.PrincipalColumns[index].ToLowerInvariant()).Append('|')
                    .Append((index + 1).ToString(CultureInfo.InvariantCulture)).Append('|')
                    .Append(foreignKey.IsDisabled ? '1' : '0').Append('|')
                    .Append(foreignKey.IsNotTrusted ? '1' : '0').Append('\n');
            }
        }
        return canonical.ToString();
    }

    private sealed record ReviewedSchemaProfile(
        string Name,
        IReadOnlyDictionary<string, string> TableShapes);
}
