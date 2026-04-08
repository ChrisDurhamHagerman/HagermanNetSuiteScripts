let
    Source = Excel.Workbook(File.Contents("C:\Users\ChrisDurham\OneDrive - hagerman.com\Documents\TaylorItems\12092025\all data Qnity 12mo 5DEC25.xlsx"), null, true),
    Subscriptions_Sheet = Source{[Item = "Subscriptions", Kind = "Sheet"]}[Data],
    #"Promoted Headers" =
        Table.PromoteHeaders(Subscriptions_Sheet, [PromoteAllScalars = true]),
    #"Changed Type" =
        Table.TransformColumnTypes(
            #"Promoted Headers",
            {
                {"team_alias", type text},
                {"offering_name", type text},
                {"contract_number", Int64.Type},
                {"subscription_id", type text},
                {"term", type text},
                {"start_date", type datetime},
                {"end_date", type datetime},
                {"autorenew_date", type any},
                {"subscription_status", type text},
                {"seat_quantity", Int64.Type},
                {"reseller_email", type text},
                {"reseller_name", type text}
            }
        ),
    #"Renamed Columns" =
        Table.RenameColumns(
            #"Changed Type",
            {
                {"offering_name", "Package Name"},
                {"contract_number", "Contract Number"},
                {"subscription_id", "Subscription Code"},
                {"start_date", "Start Date"},
                {"end_date", "End Date"},
                {"term", "Term"},
                {"team_alias", "Team"},
                // NOTE: use a different name here instead of "Seats"
                {"seat_quantity", "Seat Quantity"}
            }
        ),
    // Team + Package key for relationships
    #"Added TeamPackage" =
        Table.AddColumn(
            #"Renamed Columns",
            "TeamPackage",
            each [Team] & " | " & [Package Name],
            type text
        )
in
    #"Added TeamPackage"