# SkillSync UI/UX Design System

> **Design reference:** This document is a design-system proposal/reference, not a guarantee that every listed style, component, accessibility property, or workflow is implemented. The current navigable client features are listed in [docs/technical/user-manual.md](docs/technical/user-manual.md).

## Design Philosophy

SkillSync follows modern SaaS design principles with a professional, clean aesthetic. The design system emphasizes clarity, usability, and a cohesive visual identity across all platforms.

## Color Palette

### Primary Colors
- **Primary**: `#2563EB` (Blue) - Main action, links, primary buttons
- **Primary Light**: `#3B82F6` (Light Blue) - Hover states, secondary accents
- **Primary Dark**: `#1E40AF` (Dark Blue) - Active states, focus states

### Secondary Colors
- **Secondary**: `#0F172A` (Navy) - Background, text, sidebar
- **Secondary Light**: `#1E293B` (Light Navy) - Secondary backgrounds
- **Secondary Lighter**: `#334155` (Slate) - Borders, dividers

### Accent Colors
- **Accent**: `#10B981` (Green) - Success, positive actions
- **Accent Light**: `#34D399` (Light Green) - Hover states
- **Accent Dark**: `#059669` (Dark Green) - Active states

### Status Colors
- **Success**: `#10B981` (Green)
- **Warning**: `#F59E0B` (Amber)
- **Danger**: `#EF4444` (Red)
- **Info**: `#0EA5E9` (Cyan)

### Neutral Colors
- **50**: `#F9FAFB` - Lightest backgrounds
- **100**: `#F3F4F6` - Light backgrounds
- **200**: `#E5E7EB` - Borders, dividers
- **300**: `#D1D5DB` - Secondary borders
- **400**: `#9CA3AF` - Secondary text
- **500**: `#6B7280` - Tertiary text
- **600**: `#4B5563` - Regular text
- **700**: `#374151` - Primary text
- **800**: `#1F2937` - Headings
- **900**: `#111827` - Darkest text

## Typography

### Font Family
- **Primary**: System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue')
- **Fallback**: Sans-serif

### Font Sizes & Weights

**Display & Headings**
- H1: 2rem (32px), Weight: 600, Line Height: 1.2
- H2: 1.5rem (24px), Weight: 600, Line Height: 1.3
- H3: 1.25rem (20px), Weight: 600, Line Height: 1.4
- H4: 1.125rem (18px), Weight: 600
- H5: 1rem (16px), Weight: 600
- H6: 0.875rem (14px), Weight: 600

**Body Text**
- Base: 1rem (16px), Weight: 400, Line Height: 1.5
- Small: 0.875rem (14px), Weight: 400
- X-Small: 0.75rem (12px), Weight: 400

**Weights**
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

## Spacing System

Based on 8px unit (--spacing-unit)

- xs: 0.5rem (4px)
- sm: 0.5rem (8px)
- md: 1rem (16px)
- lg: 1.5rem (24px)
- xl: 2rem (32px)
- 2xl: 3rem (48px)

CSS Variables:
```css
.mb-1 { margin-bottom: 0.5rem; }
.mb-2 { margin-bottom: 1rem; }
.mb-3 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 2rem; }
.mb-5 { margin-bottom: 3rem; }

.mt-1, .mt-2, .mt-3, .mt-4, .mt-5
.p-1, .p-2, .p-3, .p-4
.gap-2, .gap-3, .gap-4
```

## Shadow System

### Shadow Levels
- **Shadow SM**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` - Subtle shadows for cards
- **Shadow MD**: `0 4px 6px -1px rgba(0, 0, 0, 0.1)` - Medium elevation
- **Shadow LG**: `0 10px 15px -3px rgba(0, 0, 0, 0.1)` - Large elevation
- **Shadow XL**: `0 20px 25px -5px rgba(0, 0, 0, 0.1)` - Maximum elevation (modals)

## Border Radius

- Default: 0.5rem (8px) - Form inputs, buttons
- Medium: 0.75rem (12px) - Cards
- Large: 1rem (16px) - Large containers
- Round: 9999px - Pills, avatars

## Buttons

### Button States

**Primary Button**
```
Normal: #2563EB
Hover: #1E40AF (darker), with shadow, transform up 2px
Active: #1E40AF (darker shade)
Disabled: 50% opacity

Padding: 0.5rem 1rem (md), 0.375rem 0.75rem (sm), 0.75rem 1.5rem (lg)
Border Radius: 0.5rem
Font Weight: 500
Transition: 0.2s ease-in-out
```

**Secondary Button**
```
Background: #0F172A
Hover: #1E293B
Color: White
```

**Success Button**
```
Background: #10B981
Hover: #059669
```

**Outline Button**
```
Border: 1px solid #2563EB
Color: #2563EB
Hover: Background #2563EB, Color white
```

### Button Variants
- `btn-primary` - Main call-to-action
- `btn-secondary` - Secondary actions
- `btn-success` - Positive/completion actions
- `btn-warning` - Caution/warning actions
- `btn-danger` - Destructive actions
- `btn-outline-primary` - Alternative to primary

## Forms

### Form Controls

**Text Input / Select / Textarea**
```
Border: 1px solid #E5E7EB
Border Radius: 0.5rem
Padding: 0.625rem 0.875rem
Font Size: 1rem
Focus: Border #2563EB, Box-shadow 0 0 0 0.2rem rgba(37, 99, 235, 0.15)
```

**Labels**
```
Color: #111827
Font Weight: 500
Margin Bottom: 0.5rem
```

**Form Groups**
```
Margin Bottom: 1.25rem
```

**Validation**
```
Invalid State: Border #EF4444
Error Message: Color #EF4444, Font-size 0.875rem
Feedback Text: Display block, Margin-top 0.25rem
```

## Cards

### Card Structure
```
Border: 1px solid #E5E7EB
Border Radius: 0.75rem
Box Shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
Hover: Box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
Transition: 0.3s ease-in-out
```

**Card Header**
```
Background: #F9FAFB
Border Bottom: 1px solid #E5E7EB
Font Weight: 600
Color: #0F172A
Padding: 1.25rem
```

**Card Body**
```
Padding: 1.5rem
```

## Tables

### Table Styling

**Header**
```
Background: #F3F4F6
Border Bottom: 2px solid #E5E7EB
Font Weight: 600
Color: #0F172A
Padding: 1rem
Text Transform: Uppercase
Font Size: 0.875rem
Letter Spacing: 0.5px
```

**Body Rows**
```
Padding: 1rem
Border Bottom: 1px solid #E5E7EB
Color: #111827
Hover: Background #F9FAFB
Striped: Every odd row background rgba(245, 250, 255, 0.5)
```

## Badges

### Badge Styles

**Primary**
```
Background: #2563EB
Color: White
Padding: 0.35rem 0.65rem
Border Radius: 0.25rem
Font Weight: 500
Font Size: 0.75rem
```

**Success, Warning, Danger, Info, Secondary**
- Same structure, different colors matching status colors

## Progress Bars

```
Height: 0.5rem
Background: #E5E7EB
Border Radius: 0.25rem
```

**Bar Colors**
- Default: #2563EB
- Success: #10B981
- Warning: #F59E0B
- Danger: #EF4444

## Modals

```
Content Border: 1px solid #E5E7EB
Border Radius: 0.75rem
Box Shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1)

Header Background: #F9FAFB
Header Border: 1px solid #E5E7EB
Padding: 1.5rem

Body Padding: 1.5rem

Footer Border: 1px solid #E5E7EB
Padding: 1.5rem
```

## Alerts

### Alert Styles

**Info**
```
Background: rgba(14, 165, 233, 0.1)
Border: 1px solid #0EA5E9
Color: #0369A1
```

**Success**
```
Background: rgba(16, 185, 129, 0.1)
Border: 1px solid #10B981
Color: #047857
```

**Warning**
```
Background: rgba(245, 158, 11, 0.1)
Border: 1px solid #F59E0B
Color: #92400E
```

**Danger**
```
Background: rgba(239, 68, 68, 0.1)
Border: 1px solid #EF4444
Color: #7F1D1D
```

## Navigation

### Navbar
```
Background: White
Border Bottom: 1px solid #E5E7EB
Padding: 1rem 0
Box Shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
```

**Brand**
```
Font Weight: 700
Font Size: 1.5rem
Color: #2563EB
```

**Nav Links**
```
Color: #4B5563
Font Weight: 500
Padding: 0.5rem 0.75rem
Transition: 0.2s ease-in-out
Hover: Color #2563EB
Active: Color #2563EB, Border-bottom 2px solid #2563EB
```

## Sidebar

### Sidebar Styling
```
Background: #0F172A
Color: White
Width: 250px
Position: Fixed
Left: 0
Top: 0
Min Height: 100vh
Padding: 2rem 0
Overflow-y: Auto
Box Shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
Z-Index: 100
```

**Sidebar Header**
```
Padding: 1.5rem
Border Bottom: 1px solid rgba(255, 255, 255, 0.1)
Margin Bottom: 1.5rem
```

**Sidebar Logo**
```
Font Size: 1.5rem
Font Weight: 700
Color: #3B82F6
Text Decoration: None
Display: Flex
Align Items: Center
Gap: 0.5rem
```

**Sidebar Menu Link**
```
Display: Flex
Align Items: Center
Gap: 1rem
Padding: 1rem 1.5rem
Color: rgba(255, 255, 255, 0.7)
Text Decoration: None
Transition: 0.2s ease-in-out
Font Weight: 500

Hover:
  - Background: rgba(37, 99, 235, 0.1)
  - Color: White
  - Padding-left: 2rem

Active:
  - Background: #2563EB
  - Color: White
  - Border-left: 4px solid #10B981
  - Padding-left: 1.5rem
```

## Dashboard Layout

### Dashboard Grid
```
Display: CSS Grid
Columns: repeat(auto-fit, minmax(300px, 1fr))
Gap: 1.5rem
Margin Bottom: 2rem
Responsive: Stacks to single column on mobile
```

### Stat Card
```
Background: White
Border Radius: 0.75rem
Padding: 1.5rem
Border Left: 4px solid #2563EB
Box Shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)

Stat Value: Font size 2rem, Font weight 700, Color #0F172A
Stat Label: Font size 0.875rem, Color #4B5563, Font weight 500
Stat Change: Font size 0.875rem, Margin-top 0.75rem
  - Positive: Color #10B981
  - Negative: Color #EF4444
```

### Variant Stat Cards
- **Success**: Border-left-color #10B981
- **Warning**: Border-left-color #F59E0B
- **Danger**: Border-left-color #EF4444

## Responsive Design

### Breakpoints
- **Mobile**: < 576px
- **Tablet**: 576px - 768px
- **Desktop**: 768px - 992px
- **Large Desktop**: ≥ 992px
- **Extra Large**: ≥ 1200px

### Mobile Optimizations
```
- Font sizes reduced by 10-15%
- Padding/margins reduced by 20%
- Sidebar transforms off-screen (Offcanvas)
- Grid columns stack to single column
- Touch targets minimum 44x44px
```

## Accessibility (WCAG 2.1 AA)

### Color Contrast
- Minimum 4.5:1 for body text
- Minimum 3:1 for large text
- All status colors tested for contrast

### Focus States
```
Outline: 2px solid #2563EB
Outline Offset: 2px
```

### Keyboard Navigation
- All interactive elements keyboard accessible
- Tab order logical and visible
- Focus trap in modals
- Escape key closes modals

### ARIA Attributes
- Buttons have proper role/aria-label
- Forms have associated labels
- Icons have aria-hidden or aria-label
- Live regions for dynamic content

## Component Library

### Pre-built Components

**ModernButton**
```tsx
<Button
  variant="primary"
  isLoading={false}
  icon={<Download size={16} />}
>
  Download Report
</Button>
```

**StatCard**
```tsx
<StatCard
  title="Total Students"
  value={1234}
  subtitle="Active this semester"
  icon={<Users size={32} />}
  variant="primary"
  trend={5.2}
  trendLabel="from last month"
/>
```

**ModernCard**
```tsx
<ModernCard hoverable elevated>
  <CardHeader
    icon={<BarChart3 size={20} />}
    title="Reports"
    action={<Button size="sm">Export</Button>}
  />
  <Card.Body>
    {/* Content */}
  </Card.Body>
</ModernCard>
```

## Design Tokens (CSS Variables)

```css
:root {
  /* Colors */
  --primary-color: #2563EB;
  --secondary-color: #0F172A;
  --accent-color: #10B981;

  /* Spacing */
  --spacing-unit: 8px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
```

## Best Practices

### Design Patterns

1. **Call-to-Action Hierarchy**
   - Primary action: Primary button (#2563EB)
   - Secondary actions: Outline or secondary buttons
   - Tertiary actions: Text/link buttons

2. **Form Validation**
   - Real-time validation with clear error messages
   - Error text in red with icon
   - Success state with green check mark

3. **Loading States**
   - Spinner with text "Loading..."
   - Disabled buttons during submission
   - Loading skeleton for data tables

4. **Empty States**
   - Icon representing the empty state
   - Descriptive heading
   - Call-to-action button (when applicable)

5. **Notification Patterns**
   - Toast notifications for transient messages
   - Alerts for important/persistent messages
   - Badges for status indicators

## Implementation

All components are built with:
- Bootstrap 5 for structure and grid
- Custom CSS for theming and enhancements
- React Bootstrap for interactive components
- Lucide React for icons
- Recharts for data visualization

## File Structure

```
client/src/
├── styles/
│   └── theme.css (All design tokens & utilities)
├── components/ui/
│   ├── ModernButton.tsx
│   ├── ModernCard.tsx
│   ├── StatCard.tsx
│   └── ...
├── components/layout/
│   ├── AdminLayout.tsx
│   ├── AdminSidebar.tsx
│   ├── Navbar.tsx
│   └── ...
└── pages/
    ├── admin/
    │   ├── Dashboard.tsx
    │   ├── Reports.tsx
    │   └── ...
    └── ...
```
