# Waypoint Example Organization Hierarchy

This document provides a sample organizational structure with goals at each level, demonstrating how Waypoint cascades strategic alignment through the hierarchy.

---

## Organization Structure

```
Acme Corp (Company)
├── Engineering Department
│   ├── Platform Team
│   ├── Product Team
│   └── QA Team
├── Product Department
│   ├── Product Strategy Team
│   └── UX Research Team
├── Sales Department
│   ├── Enterprise Sales Team
│   └── SMB Sales Team
└── Operations Department
    ├── IT Team
    └── HR Team
```

---

## Goals by Organization Level

### Level 0: Company (Acme Corp)

| Goal | Description | Key Results |
|------|-------------|-------------|
| **Achieve Market Leadership** | Become the #1 provider in our market segment | - Reach 40% market share by Q4<br>- NPS score above 70<br>- 50% YoY revenue growth |
| **Build World-Class Engineering** | Establish engineering excellence as a competitive advantage | - 99.9% uptime SLA<br>- Deploy to production daily<br>- Zero critical security incidents |
| **Customer-Centric Culture** | Every decision starts with customer value | - Customer satisfaction > 90%<br>- < 4 hour support response time<br>- 95% feature adoption rate |

**AI Guidelines (Company-wide):**
- Always prioritize customer impact in recommendations
- Consider cross-team dependencies when suggesting solutions
- Maintain security and compliance in all technical decisions

---

### Level 1: Departments

#### Engineering Department

**Parent Goals:** Inherits "Build World-Class Engineering" from Acme Corp

| Goal | Description | Key Results |
|------|-------------|-------------|
| **Zero-Downtime Deployments** | Ship continuously without customer impact | - 100% of deploys are zero-downtime<br>- Rollback capability within 5 minutes<br>- Automated canary releases |
| **Technical Debt Reduction** | Maintain codebase health for velocity | - 20% reduction in legacy code<br>- Test coverage > 80%<br>- Documentation for all services |

**AI Guidelines:**
- Suggest solutions that maintain backward compatibility
- Recommend incremental refactoring over big rewrites
- Always consider monitoring and observability

---

#### Product Department

**Parent Goals:** Inherits "Customer-Centric Culture" from Acme Corp

| Goal | Description | Key Results |
|------|-------------|-------------|
| **Data-Driven Decisions** | Every product decision backed by evidence | - A/B test all major features<br>- Weekly metrics review<br>- User research for each quarter |
| **Rapid Iteration** | Learn fast through quick experiments | - 2-week feature cycles<br>- MVP-first approach<br>- Kill unsuccessful features quickly |

**AI Guidelines:**
- Reference user research data when available
- Suggest measurable success criteria for features
- Balance user requests with strategic vision

---

#### Sales Department

**Parent Goals:** Inherits "Achieve Market Leadership" from Acme Corp

| Goal | Description | Key Results |
|------|-------------|-------------|
| **Enterprise Expansion** | Grow enterprise customer base | - 50 new enterprise accounts<br>- $10M ARR from enterprise<br>- 90% enterprise renewal rate |
| **Sales Efficiency** | Optimize the sales process | - Reduce sales cycle by 20%<br>- Increase win rate to 35%<br>- Automate qualification |

**AI Guidelines:**
- Prioritize high-value opportunities
- Consider competitive positioning
- Align proposals with customer business goals

---

#### Operations Department

**Parent Goals:** Inherits "Build World-Class Engineering" (IT) and "Customer-Centric Culture" (HR) from Acme Corp

| Goal | Description | Key Results |
|------|-------------|-------------|
| **Operational Excellence** | Run efficient, reliable operations | - 99.99% internal system uptime<br>- < 1 hour incident response<br>- Automated provisioning |
| **Employee Experience** | Support team productivity and satisfaction | - eNPS > 50<br>- < 2 day onboarding time<br>- 95% tool satisfaction |

**AI Guidelines:**
- Consider cost efficiency in recommendations
- Prioritize security and compliance
- Balance automation with human oversight

---

### Level 2: Teams

#### Platform Team (under Engineering)

**Parent Goals:** Inherits "Zero-Downtime Deployments" and "Technical Debt Reduction" from Engineering

| Goal | Description | Key Results |
|------|-------------|-------------|
| **Infrastructure as Code** | All infrastructure defined declaratively | - 100% IaC coverage<br>- Terraform for all cloud resources<br>- Self-service infrastructure |
| **Developer Velocity** | Enable fast, safe development | - < 10 min CI/CD pipeline<br>- One-click environments<br>- Automated security scanning |

**AI Guidelines (Platform Team specific):**
- Recommend cloud-native solutions
- Consider multi-region availability
- Suggest cost-optimized resource configurations
- Default to managed services over self-hosted

---

#### Product Team (under Engineering)

**Parent Goals:** Inherits "Zero-Downtime Deployments" from Engineering

| Goal | Description | Key Results |
|------|-------------|-------------|
| **Feature Velocity** | Ship customer value quickly | - 20 features shipped per quarter<br>- < 3 day bug fix time<br>- Weekly releases |
| **Code Quality** | Maintain high standards | - Zero critical bugs in production<br>- Code review within 4 hours<br>- 85% test coverage |

**AI Guidelines (Product Team specific):**
- Balance speed with quality
- Suggest feature flags for gradual rollouts
- Consider mobile and web parity
- Focus on user-facing impact

---

#### Enterprise Sales Team (under Sales)

**Parent Goals:** Inherits "Enterprise Expansion" from Sales

| Goal | Description | Key Results |
|------|-------------|-------------|
| **Strategic Accounts** | Land major enterprise logos | - 10 Fortune 500 customers<br>- Average deal size > $500K<br>- Multi-year contracts |
| **Expansion Revenue** | Grow within existing accounts | - 120% net revenue retention<br>- Cross-sell to 50% of accounts<br>- Executive relationships |

**AI Guidelines (Enterprise Sales specific):**
- Research company annual reports and earnings calls
- Identify business transformation initiatives
- Map to executive priorities
- Consider procurement and security requirements

---

## Goal Alignment Visualization

```
Company Goal: "Achieve Market Leadership"
    │
    ├──► Sales: "Enterprise Expansion"
    │       │
    │       └──► Enterprise Team: "Strategic Accounts"
    │               - Directly contributes to market share
    │               - Revenue drives market position
    │
    └──► Product: "Data-Driven Decisions"
            │
            └──► UX Research: Research priorities
                    - Understand enterprise needs
                    - Inform product roadmap
```

```
Company Goal: "Build World-Class Engineering"
    │
    ├──► Engineering: "Zero-Downtime Deployments"
    │       │
    │       ├──► Platform: "Infrastructure as Code"
    │       │       - Enables reliable deployments
    │       │       - Reduces human error
    │       │
    │       └──► Product Team: "Feature Velocity"
    │               - Ship without breaking things
    │               - Maintain quality at speed
    │
    └──► Operations: "Operational Excellence"
            │
            └──► IT: System reliability
                    - Support engineering infrastructure
                    - Maintain developer tools
```

---

## Cross-Team Dependencies (Sibling Visibility)

Teams with the same parent can see each other's goals for coordination:

| Team | Can See Goals From | Collaboration Opportunity |
|------|-------------------|--------------------------|
| Platform Team | Product Team, QA Team | Align on deployment pipelines, testing infrastructure |
| Product Team | Platform Team, QA Team | Coordinate releases, share quality standards |
| Enterprise Sales | SMB Sales | Share competitive intelligence, pricing strategies |
| Product Strategy | UX Research | Align roadmap with research findings |

---

## AI Guideline Inheritance

When an AI assists a Platform Team member, it receives guidelines from all levels:

1. **Company Level:** Customer impact, cross-team dependencies, security
2. **Engineering Level:** Backward compatibility, monitoring, incremental changes
3. **Platform Team Level:** Cloud-native, multi-region, cost optimization

The AI applies all relevant guidelines, with more specific (team-level) guidelines taking precedence when there's a conflict.

---

## Sample User Context

When a Platform Team engineer starts a conversation, the AI receives:

```
User: Jane Smith (Platform Engineer)
Organization: Platform Team → Engineering → Acme Corp

Current Goals:
- [Team] Infrastructure as Code (In Progress, 65%)
- [Team] Developer Velocity (In Progress, 40%)

Parent Goals (Strategic Context):
- [Engineering] Zero-Downtime Deployments
- [Engineering] Technical Debt Reduction
- [Company] Build World-Class Engineering

Guidelines:
- Recommend cloud-native solutions
- Consider multi-region availability
- Suggest solutions that maintain backward compatibility
- Always consider monitoring and observability
- Consider cross-team dependencies when suggesting solutions
```

This context ensures the AI's recommendations align with both immediate team objectives and broader organizational strategy.
