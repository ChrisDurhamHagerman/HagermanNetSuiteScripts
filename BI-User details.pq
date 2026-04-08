let
    Source = Excel.Workbook(
        File.Contents("C:\Users\ChrisDurham\OneDrive - hagerman.com\Documents\TaylorItems\12092025\usage_report Qnity 12mo 5DEC25.xlsx"),
        null,
        true
    ),
    Raw = Source{[Item="User details",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Raw, [PromoteAllScalars=true]),

    // Normalize NEW headers -> OLD internal names (works even if already old)
    #"Normalized Column Names" =
        Table.RenameColumns(
            #"Promoted Headers",
            {
                {"First name", "first_name"},
                {"Last name", "last_name"},
                {"Email", "email"},
                {"Team", "team_alias"},
                {"Product", "offering_name"},
                {"Version", "version"},
                {"Seat assignment", "seat_assignment"},
                {"Assigned date", "assigned_date"},
                {"Unassigned date", "unassigned_date"},
                {"User activity", "user_activity"},
                {"Days inactive", "days_inactive"},
                {"Access option", "access_option"},
                {"Days used", "days_used"},
                {"Monthly average", "monthly_average"},
                {"Tokens used", "tokens_used"},
                {"Last accessed", "last_accessed"}
            },
            MissingField.Ignore
        ),

    // Compatibility: add columns the OLD file had but NEW file removed
    #"Add hashed_autodesk_id if missing" =
        if Table.HasColumns(#"Normalized Column Names", "hashed_autodesk_id")
        then #"Normalized Column Names"
        else Table.AddColumn(#"Normalized Column Names", "hashed_autodesk_id", each null, type text),

    #"Add autodesk_id if missing" =
        if Table.HasColumns(#"Add hashed_autodesk_id if missing", "autodesk_id")
        then #"Add hashed_autodesk_id if missing"
        else Table.AddColumn(#"Add hashed_autodesk_id if missing", "autodesk_id", each null, type text),

    // Types (adjust datetime/date if your new export uses different types)
    #"Changed Type" =
        Table.TransformColumnTypes(
            #"Add autodesk_id if missing",
            {
                {"hashed_autodesk_id", type text},
                {"first_name", type text},
                {"last_name", type text},
                {"email", type text},
                {"autodesk_id", type text},
                {"team_alias", type text},
                {"offering_name", type text},
                {"version", type text},
                {"seat_assignment", type text},
                {"assigned_date", type datetime},
                {"unassigned_date", type datetime},
                {"user_activity", type text},
                {"days_inactive", Int64.Type},
                {"access_option", type text},
                {"days_used", Int64.Type},
                {"monthly_average", type number},
                {"tokens_used", type text},
                {"last_accessed", type date}
            }
        )
in
    #"Changed Type"