let
    Source = Excel.Workbook(File.Contents("C:\Users\ChrisDurham\OneDrive - hagerman.com\Documents\TaylorItems\12092025\all data Qnity 12mo 5DEC25.xlsx"), null, true),
    Users_Sheet = Source{[Item = "Users", Kind = "Sheet"]}[Data],
    #"Changed Type" =
        Table.TransformColumnTypes(
            Users_Sheet,
            {
                {"Column1", type text},
                {"Column2", type text},
                {"Column3", type text},
                {"Column4", type text},
                {"Column5", type text},
                {"Column6", type text},
                {"Column7", type text},
                {"Column8", type text},
                {"Column9", type text}
            }
        ),
    #"Promoted Headers" = Table.PromoteHeaders(#"Changed Type", [PromoteAllScalars = true]),
    #"Changed Type1" =
        Table.TransformColumnTypes(
            #"Promoted Headers",
            {
                {"team_alias", type text},
                {"first_name", type text},
                {"last_name", type text},
                {"email", type text},
                {"autodesk_id", type text},
                {"role", type text},
                {"account_status", type text},
                {"offering_name", type text},
                {"product_name", type text}
            }
        ),
    #"Renamed Columns" =
        Table.RenameColumns(
            #"Changed Type1",
            {
                {"team_alias", "Team"},
                {"first_name", "First Name"},
                {"last_name", "Last Name"},
                {"email", "Email"},
                {"autodesk_id", "User ID"},
                {"role", "Role"},
                {"account_status", "Status"},
                {"offering_name", "Package Name"},
                {"product_name", "Product Name"}
            }
        ),
    #"Added Index" = Table.AddIndexColumn(#"Renamed Columns", "Index", 1, 1, Int64.Type),
    #"Reordered Columns" =
        Table.ReorderColumns(
            #"Added Index",
            {"Index", "Team", "First Name", "Last Name", "Email", "User ID", "Role", "Status", "Package Name", "Product Name"}
        ),

    // bring in days_used from 'User details'
    #"Merged UserDetails" =
    Table.NestedJoin(
        #"Reordered Columns",
        {"Email", "Team", "Package Name"},
        #"User details",
        {"email", "team_alias", "offering_name"},
        "UserDetails",
        JoinKind.LeftOuter
    ),
    #"Expanded UserDetails" =
    Table.ExpandTableColumn(
        #"Merged UserDetails",
        "UserDetails",
        {"days_used"},
        {"days_used"}
    ),


    // NEW: Team + Package key for relationships
    #"Added TeamPackage" =
        Table.AddColumn(
            #"Expanded UserDetails",
            "TeamPackage",
            each [Team] & " | " & [Package Name],
            type text
        )
in
    #"Added TeamPackage"