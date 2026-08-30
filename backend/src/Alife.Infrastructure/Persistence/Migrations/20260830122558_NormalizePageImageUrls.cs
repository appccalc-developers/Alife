using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class NormalizePageImageUrls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Page content must remain portable across local, preview, and production
            // origins. Older local imports persisted the development worker origin
            // instead of the same-origin public path.
            migrationBuilder.Sql(
                """
                UPDATE sections
                SET content_json = REPLACE(
                    REPLACE(
                        content_json,
                        N'http://127.0.0.1:8788/api/images/',
                        N'/images/'),
                    N'http://localhost:8788/api/images/',
                    N'/images/')
                WHERE content_json LIKE N'%http://127.0.0.1:8788/api/images/%'
                   OR content_json LIKE N'%http://localhost:8788/api/images/%';

                UPDATE page_publication_reviews
                SET card_image_url = REPLACE(
                    REPLACE(
                        card_image_url,
                        N'http://127.0.0.1:8788/api/images/',
                        N'/images/'),
                    N'http://localhost:8788/api/images/',
                    N'/images/')
                WHERE card_image_url LIKE N'%http://127.0.0.1:8788/api/images/%'
                   OR card_image_url LIKE N'%http://localhost:8788/api/images/%';

                UPDATE page_publication_reviews
                SET submitted_snapshot_json = REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                submitted_snapshot_json,
                                N'http://127.0.0.1:8788/api/images/',
                                N'/images/'),
                            N'http://localhost:8788/api/images/',
                            N'/images/'),
                        N'http:\/\/127.0.0.1:8788\/api\/images\/',
                        N'/images/'),
                    N'http:\/\/localhost:8788\/api\/images\/',
                    N'/images/')
                WHERE submitted_snapshot_json LIKE N'%http://127.0.0.1:8788/api/images/%'
                   OR submitted_snapshot_json LIKE N'%http://localhost:8788/api/images/%'
                   OR submitted_snapshot_json LIKE N'%http:\/\/127.0.0.1:8788\/api\/images\/%'
                   OR submitted_snapshot_json LIKE N'%http:\/\/localhost:8788\/api\/images\/%';

                UPDATE page_publication_reviews
                SET published_snapshot_json = REPLACE(
                    REPLACE(
                        REPLACE(
                            REPLACE(
                                published_snapshot_json,
                                N'http://127.0.0.1:8788/api/images/',
                                N'/images/'),
                            N'http://localhost:8788/api/images/',
                            N'/images/'),
                        N'http:\/\/127.0.0.1:8788\/api\/images\/',
                        N'/images/'),
                    N'http:\/\/localhost:8788\/api\/images\/',
                    N'/images/')
                WHERE published_snapshot_json LIKE N'%http://127.0.0.1:8788/api/images/%'
                   OR published_snapshot_json LIKE N'%http://localhost:8788/api/images/%'
                   OR published_snapshot_json LIKE N'%http:\/\/127.0.0.1:8788\/api\/images\/%'
                   OR published_snapshot_json LIKE N'%http:\/\/localhost:8788\/api\/images\/%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally left empty. Reintroducing a machine-specific loopback
            // origin would make portable page content invalid again, and existing
            // canonical /images paths cannot be distinguished from migrated values.
        }
    }
}
