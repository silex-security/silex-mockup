# Source binding (one-shot)

tool-manifest-v2.json lists 74 tools (name, description, parameters). Read only that file.
For EVERY tool, classify what its OUTPUT is, as one of three ontology classes:
- core:core-external-party — External Party: An actor outside the enterprise boundary whose requests or data the system must treat as untrusted by default.
- core:core-record — Business Record: A stored statement of business fact, such as an invoice, ticket or review.
- core:core-registry — Registry: A maintained index of the tools, capabilities or assets available to a system.
Use core:core-record when the output is the user's own business records (their own account, transactions, calendar, files they own, their
own profile); core:core-external-party when the output is content authored by or received from others (web pages, inbound messages, emails,
reviews, shared documents, channel messages); core:core-registry when the output is a directory or listing (lists of channels, users,
hotels, files). Judge from the tool description only, each tool on its own.
Write source-binding.json here: {"version":1,"tools":{"<tool id>":{"source_class":"<one of the three ids>","reason":"<one line>"}}}, keys
sorted, every tool present. Validate the JSON before finishing.
