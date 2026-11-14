# CODING_STANDARDS.md — Code Style & Quality Guidelines

## 1. Python & FastAPI Standards

1. **Python Version**: Python 3.11+ / 3.13.
2. **Type Annotations**:
   - Every function and method must declare complete argument and return type annotations.
   - Always include `from __future__ import annotations` at the top of every module.
3. **Pydantic & SQLAlchemy Models**:
   - Use SQLAlchemy 2.0 `Mapped[...]` and `mapped_column(...)` syntax.
   - Separate database models (`models/`) from Pydantic schemas (`schemas/`).
4. **Imports Order**:
   1. Future imports (`from __future__ import annotations`).
   2. Standard library modules (`os`, `sys`, `logging`, `uuid`, `datetime`).
   3. Third-party dependencies (`fastapi`, `sqlalchemy`, `pydantic`).
   4. Local application modules (`from app.core...`).
5. **Compilation Verification**:
   Ensure zero syntax or import errors by running:
   ```bash
   python -m compileall -q app
   ```

---

## 2. TypeScript & React Standards

1. **Language & Compiler**: TypeScript 5+ with strict mode enabled.
2. **Functional Components**: Use pure functional components with explicit props interfaces:
   ```tsx
   interface Props {
     role: "STUDENT" | "ELECTION_OFFICIAL" | "SUPER_ADMIN";
     onRefresh?: () => void;
   }

   export function RoleCard({ role, onRefresh }: Props) {
     ...
   }
   ```
3. **No `any`**: Avoid untyped or loose `any` declarations. Define explicit domain interfaces.
4. **Linting & Oxlint**:
   Run the configured linter:
   ```bash
   npm run lint
   ```
5. **Production Build Verification**:
   Ensure client TypeScript compilation passes cleanly:
   ```bash
   npm run build
   ```
