/* SQL Server / Azure SQL. Read cleanup-demo-members.md before use.
   Default is preview: no application rows are written. Run the whole batch once.
   Do not change the target list, disable constraints, or auto-delete blockers. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LOCK_TIMEOUT 15000;
DECLARE @Apply bit = 0;
DECLARE @ExpectedDatabase sysname = N''; -- Required for Apply.
DECLARE @MaintenanceAndBackupConfirmed bit = 0; -- See runbook, including cache/seed controls.
IF @@TRANCOUNT <> 0 THROW 51000, 'Use a fresh connection without an outer transaction.', 1;
IF @Apply = 1 AND (@ExpectedDatabase <> DB_NAME() OR @ExpectedDatabase = N'' OR @MaintenanceAndBackupConfirmed <> 1)
    THROW 51000, 'Apply requires the exact database name and completed maintenance checklist.', 1;
IF HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'VIEW DEFINITION') <> 1
    THROW 51000, 'VIEW DEFINITION is required for a complete dependency inventory.', 1;
IF EXISTS(SELECT 1 FROM sys.security_policies WHERE is_enabled=1)
    THROW 51000, 'Row-level security could hide references; manual review required.', 1;

CREATE TABLE #Targets (id uniqueidentifier PRIMARY KEY, display_name nvarchar(150), email nvarchar(200), phone nvarchar(30));
INSERT #Targets VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10',N'陈以诺 Evan Chen','evan.chen@alife.local','+640000000010'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11',N'刘子谦 Daniel Liu','daniel.liu@alife.local','+640000000011'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12',N'张伟恩 Nathan Zhang','nathan.zhang@alife.local','+640000000012'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee13',N'黄嘉诚 Caleb Huang','caleb.huang@alife.local','+640000000013'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee14',N'吴德安 Andrew Wu','andrew.wu@alife.local','+640000000014'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee15',N'李恩慈 Grace Li','grace.li@alife.local','+640000000015'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee16',N'王思宁 Sophia Wang','sophia.wang@alife.local','+640000000016'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee17',N'周明洁 Joy Zhou','joy.zhou@alife.local','+640000000017'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee18',N'林悦诗 Esther Lin','esther.lin@alife.local','+640000000018'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee19',N'赵雅文 Vivian Zhao','vivian.zhao@alife.local','+640000000019');

-- Only records owned by the target, never records merely authored/approved by it.
CREATE TABLE #Owned (table_name sysname PRIMARY KEY, owner_column sysname);
INSERT #Owned VALUES
('group_memberships','member_id'), ('member_platform_roles','member_id'),
('bible_reading_progresses','member_id'), ('member_passkey_credentials','member_id'),
('passkey_ceremonies','member_id'), ('contact_profiles','member_id'),
('notification_messages','recipient_member_id'), ('member_activation_invitations','member_id');
CREATE TABLE #ChildRules (child_table sysname, child_column sysname, parent_table sysname);
INSERT #ChildRules VALUES
('activation_group_grants','activation_invitation_id','member_activation_invitations'),
('onboarding_flows','activation_invitation_id','member_activation_invitations'),
('passkey_ceremonies','onboarding_flow_id','onboarding_flows');

CREATE TABLE #Tables (oid int PRIMARY KEY, qualified nvarchar(517), key_column sysname NULL);
INSERT #Tables
SELECT t.object_id, QUOTENAME(s.name)+N'.'+QUOTENAME(t.name),
    (SELECT MAX(c.name) FROM sys.indexes i
     JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0
     JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
     WHERE i.object_id=t.object_id AND i.is_primary_key=1
     HAVING COUNT(*)=1 AND MIN(c.system_type_id)=36)
FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0;
CREATE TABLE #Plan (oid int, id uniqueidentifier, PRIMARY KEY(oid,id));
CREATE TABLE #Hits (table_name nvarchar(517), column_name sysname, kind varchar(20), referenced_id uniqueidentifier,
                   row_id uniqueidentifier NULL, row_count bigint, blocks bit);
CREATE TABLE #Edges (child int, parent int, PRIMARY KEY(child,parent));
CREATE TABLE #Order (step int IDENTITY PRIMARY KEY, oid int UNIQUE);
CREATE TABLE #Deleted (table_name nvarchar(517), row_count bigint);
DECLARE @Members int=OBJECT_ID(N'dbo.members'), @oid int, @qualified nvarchar(517), @key sysname,
        @column sysname, @sql nvarchar(max), @parent int, @parentName nvarchar(517), @parentKey sysname,
        @fk int, @join nvarchar(max), @count bigint, @added int=1;
IF @Members IS NULL THROW 51000, 'dbo.members was not found.', 1;

BEGIN TRY
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    BEGIN TRANSACTION;
    -- Apply is deliberately an offline maintenance operation. Lock all scanned tables
    -- before planning, including logical/JSON references not protected by foreign keys.
    IF @Apply=1
    BEGIN
        DECLARE locks CURSOR LOCAL FAST_FORWARD FOR SELECT qualified FROM #Tables ORDER BY oid;
        OPEN locks; FETCH NEXT FROM locks INTO @qualified;
        WHILE @@FETCH_STATUS=0
        BEGIN
            SET @sql=N'SELECT @n=COUNT_BIG(*) FROM '+@qualified+N' WITH (TABLOCKX,HOLDLOCK);';
            EXEC sys.sp_executesql @sql,N'@n bigint OUTPUT',@n=@count OUTPUT;
            FETCH NEXT FROM locks INTO @qualified;
        END;
        CLOSE locks; DEALLOCATE locks;
    END;
    SELECT DB_NAME() AS database_name, @Apply AS apply_mode;
    SELECT OBJECT_SCHEMA_NAME(f.parent_object_id) AS child_schema, OBJECT_NAME(f.parent_object_id) AS child_table,
        cc.name AS child_column, OBJECT_NAME(f.referenced_object_id) AS parent_table, pc.name AS parent_column,
        f.name AS foreign_key, f.delete_referential_action_desc, f.is_disabled, f.is_not_trusted
    FROM sys.foreign_keys f JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=f.object_id
    JOIN sys.columns cc ON cc.object_id=fc.parent_object_id AND cc.column_id=fc.parent_column_id
    JOIN sys.columns pc ON pc.object_id=fc.referenced_object_id AND pc.column_id=fc.referenced_column_id
    WHERE f.referenced_object_id=@Members ORDER BY child_schema,child_table,foreign_key,fc.constraint_column_id;
    SELECT t.id,t.display_name,m.created_utc,
        CASE WHEN m.id IS NULL THEN 'already absent'
             WHEN m.display_name=t.display_name AND m.email=t.email AND m.phone_e164=t.phone THEN 'matched'
             ELSE 'IDENTITY MISMATCH' END AS identity_check
    FROM #Targets t LEFT JOIN dbo.members m ON m.id=t.id ORDER BY t.id;
    IF EXISTS (SELECT 1 FROM dbo.members m JOIN #Targets t ON t.id=m.id
        WHERE ISNULL(m.display_name,N'')<>t.display_name OR ISNULL(m.email,N'')<>t.email OR ISNULL(m.phone_e164,N'')<>t.phone)
        THROW 51000, 'Target identity differs from seed data. No changes made.', 1;
    INSERT #Plan SELECT @Members,m.id FROM dbo.members m JOIN #Targets t ON t.id=m.id;
    -- Keep absent targets in reference scans too, so pre-existing orphans are visible.
    DECLARE owned CURSOR LOCAL FAST_FORWARD FOR
        SELECT t.oid,t.qualified,t.key_column,o.owner_column FROM #Owned o
        JOIN #Tables t ON t.oid=OBJECT_ID(N'dbo.'+QUOTENAME(o.table_name));
    OPEN owned; FETCH NEXT FROM owned INTO @oid,@qualified,@key,@column;
    WHILE @@FETCH_STATUS=0
    BEGIN
        IF @key IS NULL THROW 51000, 'Owned table has an unsupported primary key.', 1;
        SET @sql=N'INSERT #Plan SELECT @o,x.'+QUOTENAME(@key)+N' FROM '+@qualified+
            N' x JOIN #Targets t ON x.'+QUOTENAME(@column)+N'=t.id;';
        EXEC sys.sp_executesql @sql,N'@o int',@o=@oid;
        FETCH NEXT FROM owned INTO @oid,@qualified,@key,@column;
    END;
    CLOSE owned; DEALLOCATE owned;
    WHILE @added>0
    BEGIN
        SET @added=0;
        DECLARE children CURSOR LOCAL FAST_FORWARD FOR
            SELECT t.oid,t.qualified,t.key_column,r.child_column,p.oid FROM #ChildRules r
            JOIN #Tables t ON t.oid=OBJECT_ID(N'dbo.'+QUOTENAME(r.child_table))
            JOIN #Tables p ON p.oid=OBJECT_ID(N'dbo.'+QUOTENAME(r.parent_table));
        OPEN children; FETCH NEXT FROM children INTO @oid,@qualified,@key,@column,@parent;
        WHILE @@FETCH_STATUS=0
        BEGIN
            IF @key IS NULL THROW 51000, 'Dependent table has an unsupported primary key.', 1;
            SET @sql=N'INSERT #Plan SELECT @o,x.'+QUOTENAME(@key)+N' FROM '+@qualified+
                N' x JOIN #Plan p ON p.oid=@p AND p.id=x.'+QUOTENAME(@column)+
                N' WHERE NOT EXISTS(SELECT 1 FROM #Plan z WHERE z.oid=@o AND z.id=x.'+QUOTENAME(@key)+N'); SET @n=@@ROWCOUNT;';
            EXEC sys.sp_executesql @sql,N'@o int,@p int,@n bigint OUTPUT',@o=@oid,@p=@parent,@n=@count OUTPUT;
            SET @added+=CONVERT(int,@count);
            FETCH NEXT FROM children INTO @oid,@qualified,@key,@column,@parent;
        END;
        CLOSE children; DEALLOCATE children;
    END;

    -- Report all actual GUID references, including application-only links. Any reference
    -- outside the explicit deletion plan blocks the entire cleanup.
    CREATE TABLE #Ids (id uniqueidentifier PRIMARY KEY);
    INSERT #Ids SELECT id FROM #Targets UNION SELECT id FROM #Plan;
    DECLARE columns_to_scan CURSOR LOCAL FAST_FORWARD FOR
        SELECT t.oid,t.qualified,t.key_column,c.name FROM #Tables t
        JOIN sys.columns c ON c.object_id=t.oid WHERE c.system_type_id=36;
    OPEN columns_to_scan; FETCH NEXT FROM columns_to_scan INTO @oid,@qualified,@key,@column;
    WHILE @@FETCH_STATUS=0
    BEGIN
        -- A primary key itself is identity, not a reference, except shared-key dependents.
        IF @key IS NULL OR @column<>@key OR EXISTS
            (SELECT 1 FROM sys.foreign_key_columns WHERE parent_object_id=@oid AND parent_column_id=COLUMNPROPERTY(@oid,@column,'ColumnId'))
        BEGIN
            SET @sql=N'INSERT #Hits SELECT @q,@c,''GUID'',i.id,'+
                CASE WHEN @key IS NULL THEN N'NULL' ELSE N'x.'+QUOTENAME(@key) END+
                N',COUNT_BIG(*),'+CASE WHEN @key IS NULL THEN N'1' ELSE
                N'CASE WHEN EXISTS(SELECT 1 FROM #Plan p WHERE p.oid=@o AND p.id=x.'+QUOTENAME(@key)+N') THEN 0 ELSE 1 END' END+
                N' FROM '+@qualified+N' x JOIN #Ids i ON x.'+QUOTENAME(@column)+N'=i.id GROUP BY i.id'+
                CASE WHEN @key IS NULL THEN N'' ELSE N',x.'+QUOTENAME(@key) END+N';';
            EXEC sys.sp_executesql @sql,N'@q nvarchar(517),@c sysname,@o int',@q=@qualified,@c=@column,@o=@oid;
        END;
        FETCH NEXT FROM columns_to_scan INTO @oid,@qualified,@key,@column;
    END;
    CLOSE columns_to_scan; DEALLOCATE columns_to_scan;
    -- JSON, audit payloads and other text can embed IDs without a relational constraint.
    -- Counts/keys only: never emit payloads, tokens, or personal content.
    DECLARE text_columns CURSOR LOCAL FAST_FORWARD FOR
        SELECT t.oid,t.qualified,t.key_column,c.name FROM #Tables t
        JOIN sys.columns c ON c.object_id=t.oid WHERE c.system_type_id IN (167,175,231,239,35,99);
    OPEN text_columns; FETCH NEXT FROM text_columns INTO @oid,@qualified,@key,@column;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SET @sql=N'INSERT #Hits SELECT @q,@c,''TEXT/JSON'',i.id,'+
            CASE WHEN @key IS NULL THEN N'NULL' ELSE N'x.'+QUOTENAME(@key) END+
            N',COUNT_BIG(*),'+CASE WHEN @key IS NULL THEN N'1' ELSE
            N'CASE WHEN EXISTS(SELECT 1 FROM #Plan p WHERE p.oid=@o AND p.id=x.'+QUOTENAME(@key)+N') THEN 0 ELSE 1 END' END+
            N' FROM '+@qualified+N' x JOIN #Ids i ON CHARINDEX(REPLACE(CONVERT(nvarchar(36),i.id),''-'',''''),'+
            N'REPLACE(LOWER(CONVERT(nvarchar(max),x.'+QUOTENAME(@column)+N')),''-'',''''))>0 GROUP BY i.id'+
            CASE WHEN @key IS NULL THEN N'' ELSE N',x.'+QUOTENAME(@key) END+N';';
        EXEC sys.sp_executesql @sql,N'@q nvarchar(517),@c sysname,@o int',@q=@qualified,@c=@column,@o=@oid;
        FETCH NEXT FROM text_columns INTO @oid,@qualified,@key,@column;
    END;
    CLOSE text_columns; DEALLOCATE text_columns;

    -- Inspect ALL inbound foreign keys (including composite/alternate-key references)
    -- to planned rows. Never rely on CASCADE or SET NULL to modify unplanned rows.
    DECLARE fks CURSOR LOCAL FAST_FORWARD FOR
        SELECT f.object_id,c.oid,c.qualified,c.key_column,p.oid,p.qualified,p.key_column
        FROM sys.foreign_keys f JOIN #Tables c ON c.oid=f.parent_object_id
        JOIN #Tables p ON p.oid=f.referenced_object_id
        WHERE EXISTS(SELECT 1 FROM #Plan x WHERE x.oid=p.oid);
    OPEN fks; FETCH NEXT FROM fks INTO @fk,@oid,@qualified,@key,@parent,@parentName,@parentKey;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SELECT @join=STRING_AGG(CONVERT(nvarchar(max),N'x.'+QUOTENAME(c.name)+N'=y.'+QUOTENAME(p.name)),N' AND ')
        FROM sys.foreign_key_columns f
        JOIN sys.columns c ON c.object_id=f.parent_object_id AND c.column_id=f.parent_column_id
        JOIN sys.columns p ON p.object_id=f.referenced_object_id AND p.column_id=f.referenced_column_id
        WHERE f.constraint_object_id=@fk;
        SET @sql=N'INSERT #Hits SELECT @q,@c,''FK'',z.id,'+
            CASE WHEN @key IS NULL THEN N'NULL' ELSE N'x.'+QUOTENAME(@key) END+
            N',COUNT_BIG(*),'+CASE WHEN @key IS NULL THEN N'1' ELSE
            N'CASE WHEN EXISTS(SELECT 1 FROM #Plan r WHERE r.oid=@o AND r.id=x.'+QUOTENAME(@key)+N') THEN 0 ELSE 1 END' END+
            N' FROM '+@qualified+N' x JOIN '+@parentName+N' y ON '+@join+
            N' JOIN #Plan z ON z.oid=@p AND z.id=y.'+QUOTENAME(@parentKey)+N' GROUP BY z.id'+
            CASE WHEN @key IS NULL THEN N'' ELSE N',x.'+QUOTENAME(@key) END+N';';
        SET @column=OBJECT_NAME(@fk);
        EXEC sys.sp_executesql @sql,N'@q nvarchar(517),@c sysname,@o int,@p int',@q=@qualified,@c=@column,@o=@oid,@p=@parent;
        IF NOT EXISTS(SELECT 1 FROM #Edges WHERE child=@oid AND parent=@parent)
            INSERT #Edges VALUES(@oid,@parent);
        FETCH NEXT FROM fks INTO @fk,@oid,@qualified,@key,@parent,@parentName,@parentKey;
    END;
    CLOSE fks; DEALLOCATE fks;
    -- Logical dependency rules must also participate in deletion ordering.
    INSERT #Edges SELECT c.oid,p.oid FROM #ChildRules r
        JOIN #Tables c ON c.oid=OBJECT_ID(N'dbo.'+QUOTENAME(r.child_table))
        JOIN #Tables p ON p.oid=OBJECT_ID(N'dbo.'+QUOTENAME(r.parent_table))
        WHERE NOT EXISTS(SELECT 1 FROM #Edges e WHERE e.child=c.oid AND e.parent=p.oid);
    SELECT table_name,column_name,kind,referenced_id,row_id,row_count,blocks FROM #Hits
        ORDER BY blocks DESC,table_name,column_name,referenced_id;
    SELECT t.qualified AS planned_table,p.id AS planned_row_id FROM #Plan p JOIN #Tables t ON t.oid=p.oid ORDER BY t.qualified,p.id;
    SELECT DISTINCT gm.group_id AS affected_group_id,gm.member_id AS affected_member_id
        FROM dbo.group_memberships gm JOIN #Targets t ON t.id=gm.member_id;

    IF EXISTS(SELECT 1 FROM #Hits WHERE blocks=1)
    BEGIN
        IF @Apply=1 THROW 51000, 'Unplanned references exist. Entire cleanup refused; review blockers.', 1;
        PRINT 'PREVIEW: blockers exist; apply would be refused.';
    END;
    -- Unknown triggers and temporal history can retain IDs or mutate unrelated rows.
    IF EXISTS(SELECT 1 FROM #Plan p JOIN sys.triggers t ON t.parent_id=p.oid WHERE t.is_disabled=0)
       OR EXISTS(SELECT 1 FROM #Plan p JOIN sys.tables t ON t.object_id=p.oid WHERE t.temporal_type<>0)
        THROW 51000, 'Planned tables have triggers or temporal history; manual review required.', 1;
    WHILE EXISTS(SELECT 1 FROM #Plan p WHERE NOT EXISTS(SELECT 1 FROM #Order o WHERE o.oid=p.oid))
    BEGIN
        SET @oid=NULL;
        SELECT TOP(1) @oid=p.oid FROM #Plan p WHERE NOT EXISTS(SELECT 1 FROM #Order o WHERE o.oid=p.oid)
          AND NOT EXISTS(SELECT 1 FROM #Edges e WHERE e.parent=p.oid
            AND EXISTS(SELECT 1 FROM #Plan x WHERE x.oid=e.child)
            AND NOT EXISTS(SELECT 1 FROM #Order o WHERE o.oid=e.child)) ORDER BY p.oid;
        IF @oid IS NULL THROW 51000, 'Dependency cycle found; no changes made.', 1;
        INSERT #Order(oid) VALUES(@oid);
    END;
    SELECT o.step,t.qualified AS delete_order FROM #Order o JOIN #Tables t ON t.oid=o.oid ORDER BY o.step;
    IF @Apply=1
    BEGIN
        DECLARE deletes CURSOR LOCAL FAST_FORWARD FOR
            SELECT t.oid,t.qualified,t.key_column FROM #Order o JOIN #Tables t ON t.oid=o.oid ORDER BY o.step;
        OPEN deletes; FETCH NEXT FROM deletes INTO @oid,@qualified,@key;
        WHILE @@FETCH_STATUS=0
        BEGIN
            SET @sql=N'DELETE x FROM '+@qualified+N' x JOIN #Plan p ON p.oid=@o AND p.id=x.'+QUOTENAME(@key)+
                N'; SET @n=@@ROWCOUNT;';
            EXEC sys.sp_executesql @sql,N'@o int,@n bigint OUTPUT',@o=@oid,@n=@count OUTPUT;
            IF @count<>(SELECT COUNT_BIG(*) FROM #Plan WHERE oid=@oid)
                THROW 51000, 'Deleted count differs from plan; rolling back.', 1;
            INSERT #Deleted VALUES(@qualified,@count);
            FETCH NEXT FROM deletes INTO @oid,@qualified,@key;
        END;
        CLOSE deletes; DEALLOCATE deletes;
        IF EXISTS(SELECT 1 FROM dbo.members m JOIN #Targets t ON t.id=m.id)
            THROW 51000, 'Target members remain; rolling back.', 1;
        COMMIT;
        SELECT * FROM #Deleted ORDER BY table_name;
        PRINT 'COMMITTED. Complete cache invalidation before reopening traffic.';
    END
    ELSE
    BEGIN
        ROLLBACK;
        PRINT 'PREVIEW ONLY. No application rows changed.';
    END;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
END TRY
BEGIN CATCH
    IF XACT_STATE()<>0 ROLLBACK;
    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    THROW;
END CATCH;
