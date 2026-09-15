"""Static demo data returned when DINUM_USE_MOCK is enabled.

Shaped to match the real field names each upstream service actually returns
(checked against their serializers), trimmed to what a handover dossier
needs: title/subject, who created it, and when.
"""

MOCK_DOCS = [
    {
        "id": "d1111111-1111-1111-1111-111111111111",
        "title": "Q3 project roadmap",
        "excerpt": "Roadmap discussed in the last planning meeting.",
        "creator": "Amélie Rousseau",
        "created_at": "2026-09-01T09:00:00Z",
        "updated_at": "2026-09-10T14:30:00Z",
        "is_favorite": True,
    },
    {
        "id": "d2222222-2222-2222-2222-222222222222",
        "title": "Onboarding checklist",
        "excerpt": "Steps for a new team member's first two weeks.",
        "creator": "Karim Belhadj",
        "created_at": "2026-08-20T10:15:00Z",
        "updated_at": "2026-09-05T11:00:00Z",
        "is_favorite": False,
    },
    {
        "id": "d3333333-3333-3333-3333-333333333333",
        "title": "Design system audit notes",
        "excerpt": "Findings from reviewing the shared UI component library.",
        "creator": "Sofia Martins",
        "created_at": "2026-09-08T16:45:00Z",
        "updated_at": "2026-09-12T09:20:00Z",
        "is_favorite": False,
    },
]

MOCK_MESSAGES = [
    {
        "id": "m1111111-1111-1111-1111-111111111111",
        "subject": "Code review - authentication module",
        "sender": {"name": "Amélie Rousseau", "email": "amelie.rousseau@example.local"},
        "to": [{"name": "Thomas Lefèvre", "email": "thomas.lefevre@example.local"}],
        "snippet": "I pushed the changes to feature/auth, can you take a look...",
        "sent_at": "2026-09-13T17:10:00Z",
        "is_unread": False,
    },
    {
        "id": "m2222222-2222-2222-2222-222222222222",
        "subject": "Annual review - scheduling",
        "sender": {"name": "Karim Belhadj", "email": "karim.belhadj@example.local"},
        "to": [{"name": "Amélie Rousseau", "email": "amelie.rousseau@example.local"}],
        "snippet": "Please pick a slot in the shared calendar for...",
        "sent_at": "2026-09-12T11:00:00Z",
        "is_unread": True,
    },
    {
        "id": "m3333333-3333-3333-3333-333333333333",
        "subject": "Q3 progress update",
        "sender": {"name": "Project Management", "email": "pmo@example.local"},
        "to": [{"name": "Amélie Rousseau", "email": "amelie.rousseau@example.local"}],
        "snippet": "Can you send your task status before Friday...",
        "sent_at": "2026-09-14T08:32:00Z",
        "is_unread": True,
    },
]

MOCK_DRIVE_ITEMS = [
    {
        "id": "f1111111-1111-1111-1111-111111111111",
        "title": "Annual report 2026.pdf",
        "type": "file",
        "mimetype": "application/pdf",
        "size": 2456789,
        "creator": {"full_name": "Karim Belhadj"},
        "created_at": "2026-08-15T09:00:00Z",
        "updated_at": "2026-09-01T10:00:00Z",
        "is_favorite": False,
        "description": "Finalized annual report for the board meeting.",
    },
    {
        "id": "f2222222-2222-2222-2222-222222222222",
        "title": "Design assets",
        "type": "folder",
        "mimetype": None,
        "size": None,
        "creator": {"full_name": "Sofia Martins"},
        "created_at": "2026-07-30T14:00:00Z",
        "updated_at": "2026-09-11T13:00:00Z",
        "is_favorite": True,
        "description": "Shared folder for logos, icons, and mockups.",
    },
    {
        "id": "f3333333-3333-3333-3333-333333333333",
        "title": "Budget Q3.xlsx",
        "type": "file",
        "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "size": 84210,
        "creator": {"full_name": "Amélie Rousseau"},
        "created_at": "2026-09-02T08:30:00Z",
        "updated_at": "2026-09-09T17:45:00Z",
        "is_favorite": False,
        "description": "Working budget tracker for Q3 spending.",
    },
]

BY_SERVICE = {"docs": MOCK_DOCS, "drive": MOCK_DRIVE_ITEMS, "messages": MOCK_MESSAGES}
