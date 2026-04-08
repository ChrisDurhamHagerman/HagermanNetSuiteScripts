let
    Source = Excel.Workbook(File.Contents("C:\Users\ChrisDurham\OneDrive - hagerman.com\Documents\TaylorItems\12092025\all data Qnity 12mo 5DEC25.xlsx"), null, true),
    Usage_Sheet = Source{[Item="Usage",Kind="Sheet"]}[Data],
    #"Promoted Headers" = Table.PromoteHeaders(Usage_Sheet, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"team_alias", type text}, {"hashed_autodesk_id", type text}, {"first_name", type text}, {"last_name", type text}, {"email", type text}, {"autodesk_id", type text}, {"offering_name", type text}, {"product_name", type text}, {"day_used", type datetime}, {"access_option", type text}}),
    #"Renamed Columns" = Table.RenameColumns(#"Changed Type",{{"first_name", "First Name"}, {"last_name", "Last Name"}, {"email", "Email"}, {"offering_name", "Package Name"}, {"product_name", "Product Name"}, {"day_used", "Used"}, {"access_option", "License Type"}, {"autodesk_id", "User ID"}, {"team_alias", "Team"}}),
    #"Added Index" = Table.AddIndexColumn(#"Renamed Columns", "Index", 1, 1, Int64.Type),
    #"Reordered Columns" = Table.ReorderColumns(#"Added Index",{"Index", "Team", "hashed_autodesk_id", "First Name", "Last Name", "Email", "User ID", "Package Name", "Product Name", "Used", "License Type"}),
    #"Filtered Rows" = Table.SelectRows(#"Reordered Columns", each true),
    #"Filtered Rows1" = Table.SelectRows(#"Filtered Rows", each true),
    #"Changed Type1" = Table.TransformColumnTypes(#"Filtered Rows1",{{"Used", type date}})
in
    #"Changed Type1"