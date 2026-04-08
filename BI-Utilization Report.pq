let
    Source = UsersTable,
    #"Merged Queries" =
        Table.FuzzyNestedJoin(
            Source,
            {"Team", "Package Name", "Product Name", "Email"},
            UsageTable,
            {"Team", "Package Name", "Product Name", "Email"},
            "UsageTable",
            JoinKind.LeftOuter,
            [IgnoreCase = true, IgnoreSpace = true]
        ),
    #"Expanded UsageTable" =
        Table.ExpandTableColumn(
            #"Merged Queries",
            "UsageTable",
            {"Used"},
            {"Used"}
        ),
    #"Filtered Rows" =
        Table.SelectRows(#"Expanded UsageTable", each ([Used] <> null)),
    #"Merged Queries1" =
        Table.NestedJoin(
            #"Filtered Rows",
            {"Team", "Package Name", "Email"},
            #"User details",
            {"team_alias", "offering_name", "email"},
            "User details",
            JoinKind.LeftOuter
        ),
    // NOTE: 'days_used' removed from both lists below
    #"Expanded User details" =
        Table.ExpandTableColumn(
            #"Merged Queries1",
            "User details",
            {"version", "seat_assignment", "unassigned_date", "user_activity",
             "days_inactive", "monthly_average", "tokens_used", "last_accessed"},
            {"version", "seat_assignment", "unassigned_date", "user_activity",
             "days_inactive", "monthly_average", "tokens_used", "last_accessed"}
        ),
    #"Replaced Value" =
        Table.ReplaceValue(
            #"Expanded User details",
            null,
            0,
            Replacer.ReplaceValue,
            {"days_inactive"}
        )
in
    #"Replaced Value"