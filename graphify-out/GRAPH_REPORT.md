# Graph Report - .  (2026-05-10)

## Corpus Check
- Corpus is ~16,722 words - fits in a single context window. You may not need a graph.

## Summary
- 133 nodes · 127 edges · 6 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Gmail Integration|Gmail Integration]]
- [[_COMMUNITY_Data Models|Data Models]]
- [[_COMMUNITY_Extraction Pipeline|Extraction Pipeline]]
- [[_COMMUNITY_Main App API|Main App API]]
- [[_COMMUNITY_Storage Service|Storage Service]]
- [[_COMMUNITY_Auth Disconnect|Auth Disconnect]]

## God Nodes (most connected - your core abstractions)
1. `send_via_gmail()` - 6 edges
2. `TokenExpiredError` - 6 edges
3. `extract()` - 5 edges
4. `ContactData` - 4 edges
5. `exchange_code_for_tokens()` - 4 edges
6. `refresh_access_token()` - 4 edges
7. `extract_dual_side()` - 4 edges
8. `upload_card_image()` - 4 edges
9. `ExtractRequest` - 3 edges
10. `SaveContactRequest` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Extract contact intelligence from business card image(s).     Supports front-onl` --uses--> `ExtractRequest`  [INFERRED]
  backend\routes\extract.py → backend\models.py
- `Extract contact intelligence from business card image(s).     Supports front-onl` --uses--> `ContactData`  [INFERRED]
  backend\routes\extract.py → backend\models.py
- `extract()` --calls--> `upload_card_image()`  [INFERRED]
  backend\routes\extract.py → backend\services\storage.py
- `Send email route — Gmail only. Uses stored refresh token to send via the user's` --uses--> `TokenExpiredError`  [INFERRED]
  backend\routes\send_email.py → backend\services\gmail_sender.py
- `save()` --calls--> `save_contact()`  [INFERRED]
  backend\main.py → backend\services\firebase.py

## Communities

### Community 0 - "Gmail Integration"
Cohesion: 0.13
Nodes (18): Exception, connect_gmail(), Exchange authorization code for tokens.     Store refresh_token in Firestore und, Send email route — Gmail only. Uses stored refresh token to send via the user's, send_email(), SendEmailRequest, build_mime_message(), Gmail API sender service — sends emails via user's Gmail using refresh tokens. (+10 more)

### Community 1 - "Data Models"
Cohesion: 0.15
Nodes (12): ContactData, ExtractRequest, Full semantic contact data returned from AI extraction., Full semantic contact storage request., SaveContactRequest, SendEmailRequest, BaseModel, ConnectRequest (+4 more)

### Community 2 - "Extraction Pipeline"
Cohesion: 0.17
Nodes (10): extract(), Extract contact intelligence from business card image(s).     Supports front-onl, extract_contact_from_text(), LLM extraction service — Gemini 2.5 Pro for full business intelligence extractio, Use Gemini Pro to extract full business intelligence from OCR text., extract_dual_side(), extract_text_from_image(), OCR service — extract text from business card images via Google Vision API. Supp (+2 more)

### Community 3 - "Main App API"
Cohesion: 0.2
Nodes (9): contacts(), save(), update(), get_all_contacts(), Save contact to Firestore, return document ID., Fetch all contacts ordered by newest first., Update specific fields on a contact., save_contact() (+1 more)

### Community 6 - "Storage Service"
Cohesion: 0.4
Nodes (5): _get_bucket(), Firebase Storage service — upload card images, return public URLs.  Stores image, Get or initialize the storage bucket., Upload a base64-encoded card image to Firebase Storage.          Args:         b, upload_card_image()

### Community 8 - "Auth Disconnect"
Cohesion: 0.5
Nodes (4): disconnect_gmail(), Revoke the refresh token and remove it from Firestore., Revoke a refresh token with Google.     Returns True if successful, False otherw, revoke_token()

## Knowledge Gaps
- **25 isolated node(s):** `Full semantic contact data returned from AI extraction.`, `Full semantic contact storage request.`, `Auth routes — Google OAuth connect/disconnect + status check.  POST /auth/google`, `Exchange authorization code for tokens.     Store refresh_token in Firestore und`, `Revoke the refresh token and remove it from Firestore.` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `extract()` connect `Extraction Pipeline` to `Storage Service`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `Extract contact intelligence from business card image(s).     Supports front-onl` connect `Extraction Pipeline` to `Data Models`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `SendEmailRequest` connect `Gmail Integration` to `Data Models`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TokenExpiredError` (e.g. with `SendEmailRequest` and `Send email route — Gmail only. Uses stored refresh token to send via the user's`) actually correct?**
  _`TokenExpiredError` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `extract()` (e.g. with `extract_dual_side()` and `extract_contact_from_text()`) actually correct?**
  _`extract()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Full semantic contact data returned from AI extraction.`, `Full semantic contact storage request.`, `Auth routes — Google OAuth connect/disconnect + status check.  POST /auth/google` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Gmail Integration` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._