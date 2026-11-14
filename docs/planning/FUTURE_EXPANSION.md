# FUTURE_EXPANSION.md — Future Horizons & Technical Expansion

## 1. Overview

This document records long-term product expansions and advanced technical integrations planned for UniVote beyond the core multi-tenant voting modules.

---

## 2. Institutional SIS / LMS Connectors

Rather than relying solely on manual CSV/XLSX spreadsheet uploads, UniVote is designed to support direct synchronization with enterprise university systems:
- **Student Information Systems (SIS)**: Ellucian Banner, Oracle PeopleSoft, Workday Student.
- **Learning Management Systems (LMS)**: Canvas, Blackboard, Moodle.
- **Single Sign-On (SSO)**: SAML 2.0 / OpenID Connect integration for institutional federated identity (e.g., Eduroam, Shibboleth).

---

## 3. Native Mobile Client Applications

To maximize student and voter turnout, dedicated mobile clients will be delivered for **iOS** and **Android**:
- Built using **React Native** or native Swift / Kotlin.
- Direct consumption of the central FastAPI REST API.
- Push notifications for ballot opening, candidate debates, and election result releases.
- Biometric authentication (FaceID, TouchID) for fast, secure ballot access.

---

## 4. Advanced Electoral Methods

Future formal election phases will expand beyond First-Past-The-Post (FPTP) to support advanced institutional voting algorithms:
- **Ranked-Choice Voting (RCV) / Instant-Runoff Voting (IRV)**.
- **Single Transferable Vote (STV)** for multi-member representative assemblies.
- **Approval Voting & Score Voting** for committee elections.

---

## 5. End-to-End Cryptographic Voter Verifiability

- **Zero-Knowledge Proofs (ZKP)**: Allowing voters to verify that their ballot was included in the final certified tally without revealing their candidate selection to anyone.
- **Public Audit Bulletin Boards**: Cryptographically signed audit ledgers published to an immutable public ledger or transparency log.
