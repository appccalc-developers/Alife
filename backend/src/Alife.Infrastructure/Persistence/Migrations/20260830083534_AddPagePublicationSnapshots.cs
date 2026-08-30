using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alife.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPagePublicationSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "published_by_member_id",
                table: "page_publication_reviews",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "published_snapshot_json",
                table: "page_publication_reviews",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "published_utc",
                table: "page_publication_reviews",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "submitted_by_member_id",
                table: "page_publication_reviews",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "submitted_snapshot_json",
                table: "page_publication_reviews",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "submitted_utc",
                table: "page_publication_reviews",
                type: "datetime2",
                nullable: true);

            // Preserve the exact content that is currently under review before future
            // edits can change the group-owned working page. Approved rows receive the
            // same immutable copy as their initial published projection.
            migrationBuilder.Sql(
                """
                -- Older public pages may predate the review row. Create a pending
                -- submission so every queue item has an immutable copy to open.
                INSERT INTO page_publication_reviews
                (
                    id,
                    page_id,
                    status,
                    menu_sort_order,
                    return_reason,
                    submitted_by_member_id,
                    submitted_utc,
                    created_utc,
                    updated_utc
                )
                SELECT
                    CONVERT(uniqueidentifier, CONVERT(binary(16), HASHBYTES(
                        'SHA2_256',
                        CONCAT(N'AddPagePublicationSnapshots:', CONVERT(nvarchar(36), page.id))))),
                    page.id,
                    0,
                    0,
                    NULL,
                    page.created_by_member_id,
                    page.updated_utc,
                    page.updated_utc,
                    page.updated_utc
                FROM pages AS page
                LEFT JOIN page_publication_reviews AS review ON review.page_id = page.id
                WHERE page.visibility = 2
                  AND page.is_deleted = 0
                  AND review.id IS NULL;

                UPDATE review
                SET submitted_snapshot_json = snapshot.snapshot_json,
                    submitted_by_member_id = page.created_by_member_id,
                    submitted_utc = COALESCE(review.reviewed_utc, review.updated_utc, page.updated_utc)
                FROM page_publication_reviews AS review
                INNER JOIN pages AS page ON page.id = review.page_id
                CROSS APPLY
                (
                    SELECT
                        1 AS [version],
                        page.id AS [pageId],
                        page.owner_group_id AS [ownerGroupId],
                        page.created_by_member_id AS [createdByMemberId],
                        page.title_json AS [titleJson],
                        page.description_json AS [descriptionJson],
                        page.tags_json AS [tagsJson],
                        page.title_display_style AS [titleDisplayStyle],
                        page.updated_utc AS [contentUpdatedUtc],
                        COALESCE(review.reviewed_utc, review.updated_utc, page.updated_utc) AS [capturedUtc],
                        JSON_QUERY((
                            SELECT
                                section.id AS [id],
                                section.[order] AS [order],
                                section.[type] AS [type],
                                section.content_json AS [contentJson],
                                section.style_json AS [styleJson],
                                JSON_QUERY((
                                    SELECT
                                        link.id AS [id],
                                        link.[type] AS [type],
                                        link.target_group_id AS [targetGroupId],
                                        link.target_page_id AS [targetPageId],
                                        link.title AS [title],
                                        link.image_url AS [imageUrl],
                                        link.sort_order AS [sortOrder]
                                    FROM links AS link
                                    WHERE link.owner_section_id = section.id
                                    ORDER BY link.sort_order, link.id
                                    FOR JSON PATH
                                )) AS [links]
                            FROM sections AS section
                            WHERE section.page_id = page.id
                              AND section.is_deleted = 0
                            ORDER BY section.[order], section.id
                            FOR JSON PATH
                        )) AS [sections]
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                ) AS snapshot(snapshot_json);

                UPDATE page_publication_reviews
                SET published_snapshot_json = submitted_snapshot_json,
                    published_by_member_id = COALESCE(reviewed_by_member_id, submitted_by_member_id),
                    published_utc = COALESCE(reviewed_utc, submitted_utc, updated_utc)
                WHERE status = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_page_publication_reviews_published_by_member_id_published_utc",
                table: "page_publication_reviews",
                columns: new[] { "published_by_member_id", "published_utc" });

            migrationBuilder.CreateIndex(
                name: "ix_page_publication_reviews_submitted_by_member_id_submitted_utc",
                table: "page_publication_reviews",
                columns: new[] { "submitted_by_member_id", "submitted_utc" });

            migrationBuilder.AddForeignKey(
                name: "fk_page_publication_reviews_members_published_by_member_id",
                table: "page_publication_reviews",
                column: "published_by_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_page_publication_reviews_members_submitted_by_member_id",
                table: "page_publication_reviews",
                column: "submitted_by_member_id",
                principalTable: "members",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DELETE review
                FROM page_publication_reviews AS review
                INNER JOIN pages AS page
                    ON review.id = CONVERT(uniqueidentifier, CONVERT(binary(16), HASHBYTES(
                        'SHA2_256',
                        CONCAT(N'AddPagePublicationSnapshots:', CONVERT(nvarchar(36), page.id)))))
                WHERE review.status = 0
                  AND review.reviewed_by_member_id IS NULL
                  AND review.reviewed_utc IS NULL
                  AND review.created_utc = page.updated_utc
                  AND review.updated_utc = page.updated_utc;
                """);

            migrationBuilder.DropForeignKey(
                name: "fk_page_publication_reviews_members_published_by_member_id",
                table: "page_publication_reviews");

            migrationBuilder.DropForeignKey(
                name: "fk_page_publication_reviews_members_submitted_by_member_id",
                table: "page_publication_reviews");

            migrationBuilder.DropIndex(
                name: "ix_page_publication_reviews_published_by_member_id_published_utc",
                table: "page_publication_reviews");

            migrationBuilder.DropIndex(
                name: "ix_page_publication_reviews_submitted_by_member_id_submitted_utc",
                table: "page_publication_reviews");

            migrationBuilder.DropColumn(
                name: "published_by_member_id",
                table: "page_publication_reviews");

            migrationBuilder.DropColumn(
                name: "published_snapshot_json",
                table: "page_publication_reviews");

            migrationBuilder.DropColumn(
                name: "published_utc",
                table: "page_publication_reviews");

            migrationBuilder.DropColumn(
                name: "submitted_by_member_id",
                table: "page_publication_reviews");

            migrationBuilder.DropColumn(
                name: "submitted_snapshot_json",
                table: "page_publication_reviews");

            migrationBuilder.DropColumn(
                name: "submitted_utc",
                table: "page_publication_reviews");
        }
    }
}
