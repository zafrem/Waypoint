# Waypoint MCP Sequence Diagrams

This document contains sequence diagrams for the core MCP (Model Context Protocol) interaction flows in Waypoint. These diagrams illustrate how AI assistants interact with the Waypoint system to fetch organizational context, goals, and facilitate cross-organizational collaboration.

## Overview

Waypoint exposes its functionality through MCP, enabling AI assistants to:
- Fetch user-specific context and guidelines at conversation start
- Navigate organizational goal hierarchies
- Search for collaborator goals across sibling organizations
- Submit formal questions to goal owners
- Respect RBAC permissions throughout all interactions

---

## 1. MCP Resource Request Flow (`waypoint://context/current_user`)

This diagram shows how AI assistants fetch user context at the start of a conversation. The resource provides the AI with organizational context, current goals, and role-specific guidelines.

```mermaid
sequenceDiagram
    participant AI as AI Client
    participant MCP as Waypoint MCP Server
    participant Auth as Auth/Session
    participant UserDB as User Table
    participant GoalDB as Goal Table
    participant OrgDB as Organization Table

    AI->>MCP: Request waypoint://context/current_user

    MCP->>Auth: Identify requester (MCP session/auth token)
    Auth-->>MCP: userId, sessionContext

    MCP->>UserDB: Query user by userId
    UserDB-->>MCP: User { orgId, jobFunction, name }

    MCP->>OrgDB: Query organization by orgId
    OrgDB-->>MCP: Organization { name, parentId, aiGuidelines }

    MCP->>GoalDB: Query goals for orgId
    GoalDB-->>MCP: Current org goals[]

    alt Has parent organization
        MCP->>OrgDB: Query parent org by parentId
        OrgDB-->>MCP: Parent Organization { name, aiGuidelines }

        MCP->>GoalDB: Query parent org goals
        GoalDB-->>MCP: Parent goals[] (strategic context)
    end

    Note over MCP: Extract role-specific aiGuidelines<br/>based on user's jobFunction

    Note over MCP: Format system prompt with:<br/>- User context<br/>- Org hierarchy<br/>- Relevant goals<br/>- Role-specific guidelines

    MCP-->>AI: Formatted system prompt + context
```

**Key Points:**
- The AI receives a complete context package at conversation start
- Role-specific guidelines ensure the AI behaves appropriately for the user's job function
- Parent goal context provides strategic alignment

---

## 2. MCP Tool: `get_parent_goals(org_id)`

This diagram shows how an AI retrieves strategic context from a parent organization. This enables goal alignment discussions by understanding higher-level objectives.

```mermaid
sequenceDiagram
    participant AI as AI Client
    participant MCP as Waypoint MCP Server
    participant RBAC as RBAC Engine
    participant OrgDB as Organization Table
    participant GoalDB as Goal Table

    AI->>MCP: Call get_parent_goals(org_id)

    MCP->>RBAC: Validate permission<br/>(userId, org_id, "read_parent_goals")

    alt Permission Denied
        RBAC-->>MCP: Denied (user not in org hierarchy)
        MCP-->>AI: Error: Access denied
    end

    RBAC-->>MCP: Allowed

    MCP->>OrgDB: Query organization by org_id
    OrgDB-->>MCP: Organization { parentId }

    alt No parent exists
        MCP-->>AI: Response: No parent organization (top-level org)
    end

    MCP->>OrgDB: Query parent organization by parentId
    OrgDB-->>MCP: Parent Org { id, name, description }

    MCP->>GoalDB: Query goals WHERE orgId = parentId
    GoalDB-->>MCP: Parent goals[]

    Note over MCP: Filter goals based on<br/>visibility settings and RBAC

    MCP-->>AI: Parent goals with context:<br/>- Goal titles and descriptions<br/>- Key results<br/>- Status and progress
```

**Key Points:**
- RBAC validation ensures users can only access goals within their organizational hierarchy
- Returns strategic goals that provide context for alignment discussions
- Top-level organizations receive an appropriate response indicating no parent exists

---

## 3. MCP Tool: `search_collaborator_goals(keyword)`

This diagram shows lateral visibility - how an AI can search for goals across peer (sibling) organizations to facilitate cross-team collaboration.

```mermaid
sequenceDiagram
    participant AI as AI Client
    participant MCP as Waypoint MCP Server
    participant RBAC as RBAC Engine
    participant UserDB as User Table
    participant OrgDB as Organization Table
    participant GoalDB as Goal Table

    AI->>MCP: Call search_collaborator_goals(keyword)

    MCP->>UserDB: Get user's orgId
    UserDB-->>MCP: User { orgId }

    MCP->>OrgDB: Get user's organization
    OrgDB-->>MCP: Organization { parentId }

    MCP->>OrgDB: Query sibling orgs WHERE parentId = user's parentId<br/>AND id != user's orgId
    OrgDB-->>MCP: Sibling organizations[]

    Note over MCP: Sibling orgs share the same parent<br/>(peer teams/departments)

    loop For each sibling org
        MCP->>RBAC: Check read permission for sibling
        RBAC-->>MCP: Allowed (sibling = read-only access)
    end

    MCP->>GoalDB: Search goals WHERE orgId IN sibling_ids<br/>AND (title ILIKE keyword OR description ILIKE keyword)
    GoalDB-->>MCP: Matching goals[]

    Note over MCP: Apply visibility filters:<br/>- Only goals marked visible to siblings<br/>- Exclude confidential goals

    MCP-->>AI: Search results:<br/>- Goal title, org name<br/>- Brief description<br/>- Owner contact info<br/>(Read-only, no write access)
```

**Key Points:**
- Users can only search goals within sibling organizations (same parent)
- Results are read-only - no modification access to sibling goals
- Confidential goals are excluded from search results
- Enables discovery of collaboration opportunities

---

## 4. MCP Tool: `submit_question(goal_id, question)`

This diagram shows how an AI can draft and submit a formal question to a goal owner, creating a structured communication channel.

```mermaid
sequenceDiagram
    participant AI as AI Client
    participant MCP as Waypoint MCP Server
    participant RBAC as RBAC Engine
    participant GoalDB as Goal Table
    participant CommentDB as Comment Table
    participant Notify as Notification Service

    AI->>MCP: Call submit_question(goal_id, question)

    MCP->>GoalDB: Get goal by goal_id
    GoalDB-->>MCP: Goal { orgId, ownerId, title }

    MCP->>RBAC: Validate permission<br/>(userId, goal.orgId, "discuss_goal")

    alt Permission Denied
        RBAC-->>MCP: Denied
        MCP-->>AI: Error: Cannot discuss this goal<br/>(outside org hierarchy)
    end

    RBAC-->>MCP: Allowed

    Note over MCP: Validate question content:<br/>- Not empty<br/>- Within length limits<br/>- No prohibited content

    MCP->>CommentDB: Create Comment {<br/>  goalId: goal_id,<br/>  authorId: userId,<br/>  content: question,<br/>  type: "QUESTION",<br/>  status: "PENDING"<br/>}
    CommentDB-->>MCP: Comment { id, createdAt }

    MCP->>Notify: Queue notification for goal owner
    Notify-->>MCP: Notification queued

    MCP-->>AI: Success response:<br/>- threadId (comment.id)<br/>- Confirmation message<br/>- Expected response time
```

**Key Points:**
- Questions are stored as Comment records with type "QUESTION"
- RBAC ensures users can only ask questions about goals they have visibility into
- Goal owner receives notification about the new question
- Returns a thread ID for tracking the conversation

---

## 5. RBAC Permission Resolution

This diagram shows how permissions are dynamically determined based on organizational relationships. This is the core authorization logic used by all MCP tools.

```mermaid
sequenceDiagram
    participant Request as Incoming Request
    participant RBAC as RBAC Engine
    participant UserDB as User Table
    participant OrgDB as Organization Table
    participant Matrix as Permission Matrix

    Request->>RBAC: Check permission<br/>(userId, targetOrgId, action)

    RBAC->>UserDB: Get user by userId
    UserDB-->>RBAC: User { orgId: userOrgId }

    RBAC->>OrgDB: Get user's organization
    OrgDB-->>RBAC: UserOrg { parentId: userParentId }

    RBAC->>OrgDB: Get target organization
    OrgDB-->>RBAC: TargetOrg { parentId: targetParentId }

    Note over RBAC: Compute organizational relationship

    alt userOrgId == targetOrgId
        Note over RBAC: Relationship: SELF
    else targetOrgId == userParentId
        Note over RBAC: Relationship: PARENT
    else targetParentId == userOrgId
        Note over RBAC: Relationship: CHILD
    else userParentId == targetParentId
        Note over RBAC: Relationship: SIBLING
    else Check if in hierarchy
        RBAC->>OrgDB: Traverse org tree
        OrgDB-->>RBAC: Hierarchy path
        alt Target in ancestor/descendant chain
            Note over RBAC: Relationship: ANCESTOR/DESCENDANT
        else
            Note over RBAC: Relationship: NONE (outside hierarchy)
        end
    end

    RBAC->>Matrix: Lookup permissions for<br/>(relationship, action)

    Note over Matrix: Permission Matrix:<br/>SELF: full CRUD<br/>PARENT: read goals, submit questions<br/>CHILD: read goals, provide guidance<br/>SIBLING: read-only goals, search<br/>NONE: no access

    Matrix-->>RBAC: Allowed actions[]

    alt action in Allowed actions
        RBAC-->>Request: ALLOWED
    else
        RBAC-->>Request: DENIED (reason)
    end
```

**Permission Matrix Summary:**

| Relationship | Goals | Comments | Organization |
|-------------|-------|----------|--------------|
| **SELF** | Full CRUD | Full CRUD | Read, Update |
| **PARENT** | Read | Submit questions | Read |
| **CHILD** | Read, Comment | Read, Respond | Read |
| **SIBLING** | Read (visible only) | Submit questions | Read (basic) |
| **NONE** | No access | No access | No access |

**Key Points:**
- Relationship is computed dynamically based on org hierarchy
- Permission matrix maps relationships to allowed actions
- SELF always has full access to own organization's resources
- Siblings have limited, read-only lateral visibility
- Users outside the hierarchy have no access

---

## Integration Notes

### MCP Session Authentication
All requests include session context that identifies the requesting user. The Waypoint MCP server extracts the `userId` from the authenticated session before processing any request.

### Error Handling
All tools return structured error responses when:
- Authentication fails
- RBAC denies permission
- Requested resources don't exist
- Validation fails

### Caching Considerations
- User context can be cached per session
- Organizational hierarchy can be cached with TTL
- Goal data should be fetched fresh for accuracy
