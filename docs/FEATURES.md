# User can log in
- Create an admin user with default password on first start, prompt user to create new password
- Once the user has logged in, remember them
- Allow the user to create other users
- Assume all users have access to all books - it's just for personal use initially anyway

# Books can be created
- Books can be created
- The book has a corresponding database entry and markdown file
- The book is created at v1
- Database is SQLite initially, though could be changed to a heavy-duty RDS solution in the future
- File storage is backed by a directory on the file system initially, though may support S3 in feature
- Book is stored in a single markdown

# Books can be modified
- Titles, tags and descriptions of books can be modified
- Modifying a book creates a new version

# Books can be deleted
- Books can be deleted
- User must type "delete me" to delete the book

# Books can be edited 
- User is presented a rich markdown editor
- The markdown editor allows the user to jump between chapters

# Books are autosaved with versions 
- Books are auto saved during editing periodically
- When the book is saved a new version is created

# User can configure how many versions of the book to keep for each book
- -1 is all versions
- Automatically delete old versions

# User can download markdown
- User can download the markdown of the book from the editor

# Spell and grammar checking
- Spelling and grammar checking works for long documents in the user's language
- The language can be overriden and selected
- If you must select a default to fall back to, choose en(GB) as I'll be the primary user of this

# User can see version history to revert to previous version
- User can revert to a previous version in the version history
- Safeguard this action

# User can manage Characters and Relationships in a tab of the editor
- User can manage Characters and Relationships in a tab of the editor
- If a character is mentioned in the text, the user can click on it to open a description on the side
- During the writing of my last book, I'd draw a family tree on a whiteboard for this, it would be better to have a feature in software

# User can make general notes relating to the book
- Stored in separate markdown files

# User can store whiteboards against books

# User can export for publishing
- User can select publish format
- Use common KDP options
- Optionally include table of contents (do this by default)
- See [BOOK_PIPELINE.md](BOOK_PIPELINE.md) for instructions on how it was done for the book I published