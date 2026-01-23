# GitHub Epic Visualizer

A tool that visualizes GitHub Epic issues, their Batch sub-issues, and task dependencies in an interactive diagram.

**Experience Qualities**:

1. **Clarity** - Complex issue hierarchies become immediately understandable through visual grouping and color coding
2. **Interactive** - Pan, zoom, and explore the diagram to understand relationships between issues
3. **Informative** - Status indicators and dependency lines reveal project progress at a glance

**Complexity Level**: Light Application (multiple features with basic state)

- Requires fetching nested GitHub data, parsing dependencies, and rendering an interactive diagram with relationship lines

## Essential Features

### GitHub Authentication

- **Functionality**: Automatically detect signed-in GitHub Spark user and display their auth status
- **Purpose**: Enable access to private repositories the user has permission to view
- **Trigger**: On app load, automatically checks for authenticated user via spark.user() API
- **Progression**: App loads → Check spark.user() → Display auth status → Show user avatar if signed in
- **Success criteria**: Signed-in users see their avatar and "Private repos accessible" message; unauthenticated users see a warning about public-only access

### Issue Browser

- **Functionality**: Browse and select issues from repositories the user has access to
- **Purpose**: Allow users to easily find and select the Epic issue they want to visualize
- **Trigger**: User clicks "Browse Issues" button
- **Progression**: Click button → Open issue picker modal → Search/filter issues → Select issue → Close modal and load issue data
- **Success criteria**: Selected issue is loaded and visualized correctly

### Epic URL Input

- **Functionality**: Input field for users to enter a GitHub Epic issue URL
- **Purpose**: Allow users to specify the Epic issue they want to visualize
- **Trigger**: User types/pastes URL into input field and submits
- **Progression**: User enters URL → Validate format → Fetch issue data → Load visualization

### Issue Hierarchy Fetching

- **Functionality**: Recursively fetch Batch sub-issues from Epic, then task sub-issues from each Batch
- **Purpose**: Gather all data needed for complete visualization
- **Trigger**: After Epic URL is validated
- **Progression**: Fetch Epic → Extract sub-issues → Identify Batches → Fetch Batch sub-issues → Parse dependencies
- **Success criteria**: All three levels (Epic → Batches → Tasks) are fetched and structured

### Dependency Parsing

- **Functionality**: Extract dependencies from issue relationships and body text
- **Purpose**: Enable drawing dependency arrows between issues
- **Trigger**: During issue fetching
- **Progression**: Check issue relationships → Parse body for "depends on #X" patterns → Build dependency graph
- **Success criteria**: Dependencies are correctly identified and mapped

### Interactive Diagram

- **Functionality**: Render batches as grouped containers with task cards, connected by dependency arrows
- **Purpose**: Visualize the entire Epic structure with relationships
- **Trigger**: After all data is fetched
- **Progression**: Layout batches → Position tasks within → Draw dependency arrows → Enable pan/zoom
- **Success criteria**: Diagram matches reference image style with colored cards, grouping, and arrows

## Edge Case Handling

- **Invalid URL**: Show inline error with format hint
- **Not an Epic**: Display message indicating issue type doesn't match
- **No sub-issues**: Show empty state with helpful message
- **Circular dependencies**: Detect and handle gracefully without infinite loops
- **Rate limiting**: Show loading states and retry guidance

## Design Direction

Technical, organized, and data-rich - like a project management tool that makes complex information accessible.

## Color Selection

- **Primary Color**: `oklch(0.55 0.2 250)` - Deep blue for primary actions and Epic headers
- **Secondary Colors**:
  - Green `oklch(0.7 0.18 145)` - Done/completed status
  - Yellow `oklch(0.85 0.18 85)` - In Progress status
  - Blue `oklch(0.7 0.15 230)` - Planned status
  - Gray `oklch(0.7 0 0)` - Not Planned status
- **Accent Color**: `oklch(0.65 0.2 30)` - Orange for important highlights
- **Foreground/Background Pairings**:
  - Background (light gray `oklch(0.97 0 0)`): Foreground (`oklch(0.2 0 0)`) - Ratio 10:1 ✓
  - Card (white `oklch(1 0 0)`): Foreground (`oklch(0.3 0 0)`) - Ratio 8:1 ✓
  - Primary Blue: White text - Ratio 5:1 ✓

## Font Selection

Clean and technical with excellent readability for dense information display.

- **Typographic Hierarchy**:
  - H1 (Epic Title): Inter Bold/24px/tight
  - H2 (Batch Title): Inter SemiBold/16px/normal
  - Body (Task cards): Inter Regular/13px/normal
  - Caption (Issue numbers): Inter Medium/11px/normal

## Animations

Subtle transitions for pan/zoom interactions, smooth arrow drawing, and gentle card hover effects to maintain focus on the data.

## Component Selection

- **Components**: Card for batch containers and task items, Input for URL entry, Button for actions, Badge for status indicators, ScrollArea for overflow
- **Customizations**: Custom SVG canvas for dependency arrows, draggable/zoomable container
- **States**: Cards highlight on hover, dependency lines emphasize on connected card hover
- **Icon Selection**: GitBranch for dependencies, Circle variants for status, Link for URL input
- **Spacing**: 16px gap between batches, 8px gap between task cards, 12px padding inside cards
- **Mobile**: Horizontal scroll with pinch-to-zoom, simplified layout for smaller screens

---

## Implementation Notes

### Technology Stack

- **Framework**: Next.js 16 with App Router and TypeScript
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Theme**: Dark mode as default, using OKLCH color space

### Architecture

```text
src/
├── app/
│   ├── globals.css      # Global styles with PRD color scheme
│   ├── layout.tsx       # Root layout with dark mode and Inter font
│   └── page.tsx         # Main application page
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── AuthStatus.tsx   # GitHub auth status display
│   ├── BatchContainer.tsx # Batch grouping with tasks
│   ├── DependencyCanvas.tsx # SVG arrow rendering
│   ├── EpicDiagram.tsx  # Main diagram with pan/zoom
│   ├── EpicInput.tsx    # URL input with validation
│   ├── StatusBadge.tsx  # Status indicator badges
│   └── TaskCard.tsx     # Individual task cards
├── hooks/
│   └── useEpicVisualizer.ts # State management hook
├── lib/
│   ├── github.ts        # GitHub API service
│   └── utils.ts         # Utility functions
└── types/
    └── index.ts         # TypeScript interfaces
```

### Deviations from Original PRD

1. **Authentication**: Instead of `spark.user()` API (GitHub Spark specific), implemented Personal Access Token authentication that users can configure manually. This makes the app work as a standalone Next.js application.

2. **Issue Browser**: Simplified to URL input only in initial implementation. Browse functionality can be added later.

3. **Font**: Using Inter font as specified, loaded via Next.js font optimization.

### GitHub API Integration

The app uses the official GitHub REST APIs with versioned headers (`X-GitHub-Api-Version: 2022-11-28`):

- **Sub-Issues API**: `GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues`
  - Used to fetch child issues (Batches from Epic, Tasks from Batch)
  - [API Documentation](https://docs.github.com/en/rest/issues/sub-issues)

- **Issue Dependencies API**: `GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by`
  - Used to fetch dependency relationships between issues
  - [API Documentation](https://docs.github.com/en/rest/issues/issue-dependencies)

### API Limitations

- GitHub's public API rate limit is 60 requests/hour without authentication
- With a token, rate limit increases to 5,000 requests/hour
- Sub-issues and dependencies require fine-grained tokens with "Issues" repository permission (read)
