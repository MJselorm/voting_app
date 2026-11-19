from enum import Enum


class PlatformRole(str, Enum):
    PLATFORM_SUPER_ADMIN = "PLATFORM_SUPER_ADMIN"


class OrganizationRole(str, Enum):
    ORGANISATION_OWNER = "ORGANISATION_OWNER"
    ORGANISATION_ADMIN = "ORGANISATION_ADMIN"
    ELECTION_OFFICIAL = "ELECTION_OFFICIAL"
    MEMBER = "MEMBER"


class AssignmentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"


class PlatformPermission(str, Enum):
    DASHBOARD_VIEW = "platform.dashboard.view"
    ORGANISATIONS_VIEW = "platform.organisations.view"
    ORGANISATIONS_CREATE = "platform.organisations.create"
    ORGANISATIONS_APPROVE = "platform.organisations.approve"
    ORGANISATIONS_REJECT = "platform.organisations.reject"
    ORGANISATIONS_SUSPEND = "platform.organisations.suspend"
    ORGANISATIONS_RESTORE = "platform.organisations.restore"
    USERS_VIEW = "platform.users.view"
    ROLES_ASSIGN = "platform.roles.assign"
    ROLES_REVOKE = "platform.roles.revoke"
    AUDIT_VIEW = "platform.audit.view"
    SETTINGS_MANAGE = "platform.settings.manage"


class OrganizationPermission(str, Enum):
    VIEW = "organisation.view"
    UPDATE = "organisation.update"
    ADMINS_MANAGE = "organisation.admins.manage"
    ROLES_MANAGE = "organisation.roles.manage"
    MEMBERS_VIEW = "organisation.members.view"
    MEMBERS_MANAGE = "organisation.members.manage"
    ELECTIONS_MANAGE = "organisation.elections.manage"
    RESULTS_REVIEW = "organisation.results.review"


# Centralized role to permission mapping
PLATFORM_ROLE_PERMISSIONS: dict[PlatformRole, set[PlatformPermission]] = {
    PlatformRole.PLATFORM_SUPER_ADMIN: {
        PlatformPermission.DASHBOARD_VIEW,
        PlatformPermission.ORGANISATIONS_VIEW,
        PlatformPermission.ORGANISATIONS_CREATE,
        PlatformPermission.ORGANISATIONS_APPROVE,
        PlatformPermission.ORGANISATIONS_REJECT,
        PlatformPermission.ORGANISATIONS_SUSPEND,
        PlatformPermission.ORGANISATIONS_RESTORE,
        PlatformPermission.USERS_VIEW,
        PlatformPermission.ROLES_ASSIGN,
        PlatformPermission.ROLES_REVOKE,
        PlatformPermission.AUDIT_VIEW,
        PlatformPermission.SETTINGS_MANAGE,
    }
}

ORGANIZATION_ROLE_PERMISSIONS: dict[OrganizationRole, set[OrganizationPermission]] = {
    OrganizationRole.ORGANISATION_OWNER: {
        OrganizationPermission.VIEW,
        OrganizationPermission.UPDATE,
        OrganizationPermission.ADMINS_MANAGE,
        OrganizationPermission.ROLES_MANAGE,
        OrganizationPermission.MEMBERS_VIEW,
        OrganizationPermission.MEMBERS_MANAGE,
        OrganizationPermission.ELECTIONS_MANAGE,
        OrganizationPermission.RESULTS_REVIEW,
    },
    OrganizationRole.ORGANISATION_ADMIN: {
        OrganizationPermission.VIEW,
        OrganizationPermission.UPDATE,
        OrganizationPermission.ROLES_MANAGE,
        OrganizationPermission.MEMBERS_VIEW,
        OrganizationPermission.MEMBERS_MANAGE,
        OrganizationPermission.ELECTIONS_MANAGE,
    },
    OrganizationRole.ELECTION_OFFICIAL: {
        OrganizationPermission.VIEW,
        OrganizationPermission.ELECTIONS_MANAGE,
        OrganizationPermission.RESULTS_REVIEW,
    },
    OrganizationRole.MEMBER: {
        OrganizationPermission.VIEW,
        OrganizationPermission.MEMBERS_VIEW,
    },
}
