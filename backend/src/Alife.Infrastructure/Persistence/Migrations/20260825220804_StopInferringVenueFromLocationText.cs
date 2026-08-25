using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StopInferringVenueFromLocationText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE module
                SET module.is_required = 0,
                    module.updated_utc = SYSUTCDATETIME()
                FROM event_module_instances module
                INNER JOIN event_plans event_plan ON event_plan.id = module.event_plan_id
                INNER JOIN group_events event_record ON event_record.id = event_plan.event_id
                CROSS APPLY (
                    SELECT CASE WHEN ISJSON(event_record.event_data_json) = 1
                                THEN event_record.event_data_json ELSE N'{}' END
                ) facts(safe_json)
                WHERE module.module_key = N'venue'
                  AND JSON_QUERY(facts.safe_json, '$.enabledModules') IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM event_venue_bookings booking
                      WHERE booking.event_id = event_record.id
                  );

                UPDATE readiness
                SET readiness.is_required = 0,
                    readiness.status = 0,
                    readiness.updated_utc = SYSUTCDATETIME()
                FROM event_readiness_gates readiness
                INNER JOIN event_module_instances module ON module.id = readiness.module_instance_id
                WHERE module.module_key = N'venue'
                  AND module.is_required = 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE module
                SET module.is_required = 1,
                    module.updated_utc = SYSUTCDATETIME()
                FROM event_module_instances module
                INNER JOIN event_plans event_plan ON event_plan.id = module.event_plan_id
                INNER JOIN group_events event_record ON event_record.id = event_plan.event_id
                CROSS APPLY (
                    SELECT CASE WHEN ISJSON(event_record.event_data_json) = 1
                                THEN event_record.event_data_json ELSE N'{}' END
                ) facts(safe_json)
                WHERE module.module_key = N'venue'
                  AND JSON_QUERY(facts.safe_json, '$.enabledModules') IS NULL
                  AND (
                      NULLIF(JSON_VALUE(facts.safe_json, '$.locationName.en'), N'') IS NOT NULL
                      OR NULLIF(JSON_VALUE(facts.safe_json, '$.locationName.zh'), N'') IS NOT NULL
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM event_venue_bookings booking
                      WHERE booking.event_id = event_record.id
                  );

                UPDATE readiness
                SET readiness.is_required = 1,
                    readiness.updated_utc = SYSUTCDATETIME()
                FROM event_readiness_gates readiness
                INNER JOIN event_module_instances module ON module.id = readiness.module_instance_id
                WHERE module.module_key = N'venue'
                  AND module.is_required = 1;
                """);
        }
    }
}
