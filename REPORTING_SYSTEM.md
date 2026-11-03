# SkillSync Reporting System Documentation

> **Current implementation reference:** This earlier design describes report metrics and access levels that are not all implemented. The current admin-only report routes, calculations, PDF behavior, and limitations are documented in [docs/technical/api.md](docs/technical/api.md) and [docs/technical/developer-manual.md](docs/technical/developer-manual.md).

## Overview

The SkillSync reporting system provides comprehensive analytics and insights for administrators, employers, and students. All reports support data visualization and PDF export capabilities.

## Report Types

### 1. Student Readiness Report

**Purpose**: Assess the overall preparedness of students for internship placements

**Metrics Included**:
- Overall Readiness Score (0-100)
- Technical Skills Score
- Soft Skills Score
- Experience Score
- Skill Gap Analysis
- Total Skills Count
- Active Applications

**Data Elements**:
```
- Student Name
- University
- Year of Study
- GPA
- Skills (with proficiency levels)
- Years of Experience per Skill
- Certifications
- Portfolio URL
- Number of Active Applications
- Match Rate with Available Internships
```

**Use Cases**:
- Identify high-performing students
- Detect students requiring intervention
- Generate personalized learning recommendations
- Track student progress over time
- Benchmark against cohort averages

**Access Level**:
- Admin: Full access to all students
- Student: Self-view only

**Calculation Method**:
```
technicalScore = (avg proficiency level of technical skills) * 100 / 5
softSkillScore = (avg proficiency level of soft skills) * 100 / 5
experienceScore = (total years of experience / max expected years) * 100
overallScore = (technicalScore * 0.4) + (softSkillScore * 0.3) + (experienceScore * 0.3)
```

### 2. Internship Match Report

**Purpose**: Analyze compatibility between students and available internship positions

**Match Score Components**:
- **Skill Match** (40%): Percentage of required skills the student possesses
- **Experience Match** (30%): Student experience level vs. position requirements
- **Education Match** (20%): Student's educational background alignment
- **Location Match** (10%): Geographic alignment or remote compatibility

**Data Elements**:
```
- Application ID
- Student Name & University
- Internship Title & Company
- Match Score (0-100)
- Individual Match Components
  - Skills matched / required
  - Experience level alignment
  - Educational fit
  - Location compatibility
- Application Status
- Time to Decision (avg)
```

**Use Cases**:
- Identify best student-internship pairs
- Understand why certain matches fail
- Improve matching algorithm
- Career counseling and guidance
- Track matching success metrics

**Access Level**:
- Admin: Full access
- Employer: Their posted internships only
- Student: Their own applications only

**Calculation Method**:
```
skillMatch = (matched_skills / required_skills) * 100
experienceMatch = (student_avg_proficiency / required_level) * 100, capped at 100
educationMatch = (student_education_matches / total_considerations) * 100
locationMatch = remote ? 100 : (distance <= 50km ? 100 : 0)

matchScore = (skillMatch * 0.4) + (experienceMatch * 0.3) +
             (educationMatch * 0.2) + (locationMatch * 0.1)
```

### 3. Application Statistics Report

**Purpose**: Track application workflow metrics and recruitment funnel performance

**Key Metrics**:
- Total Applications
- Applications by Status (PENDING, UNDER_REVIEW, SHORTLISTED, INTERVIEW_SCHEDULED, OFFERED, ACCEPTED, REJECTED, WITHDRAWN)
- Acceptance Rate (%)
- Average Time to Decision (days)
- Application Completion Rate
- Top 10 Most Applied Internships

**Data Elements**:
```
- Application Count by Status
- Status Distribution (pie chart)
- Top Internship Positions by Application Volume
- Application Trend (time series)
- Conversion Rates (Pending → Accepted)
- Average Duration in Each Status
- Rejection Reasons (if tracked)
- Offer Acceptance Rate
```

**Use Cases**:
- Monitor recruitment pipeline health
- Identify bottlenecks in hiring process
- Benchmark recruitment efficiency
- Forecast placement success
- Improve employer recruitment process

**Access Level**:
- Admin: Full access
- Employer: Their applications only
- Student: Their own applications only

**Reporting Period**:
- Daily (last 24 hours)
- Weekly (last 7 days)
- Monthly (last 30 days)
- Semester-wide
- Custom date range

### 4. Skills Demand Report

**Purpose**: Identify market skill demand vs. available talent

**Key Metrics**:
- Total Skills Tracked
- Skill Demand (number of internship positions requiring skill)
- Available Talent (number of students with skill)
- Skill Gap (demand - supply)
- Trend (Increasing, Stable, Decreasing)
- Skill Category Distribution

**Data Elements**:
```
- Skill Name
- Category (Programming, Framework, Database, Cloud, etc.)
- Demand Count (positions requiring skill)
- Available Students (students with skill)
- Skill Gap (negative = surplus, positive = shortage)
- Trend Analysis
- Historical Demand Trend (3-month)
- Top 10 Most Demanded Skills
- Top 10 Skills with Highest Shortage
- Skills with No Current Supply
```

**Use Cases**:
- Curriculum planning (identify skills to teach)
- Career counseling (recommend high-demand skills)
- Employer insights (understand talent availability)
- Student guidance (suggest skill development)
- Strategic planning (predict future skill demands)

**Access Level**:
- Admin: Full access
- Employer: Aggregated view (no individual identification)
- Student: Relevant to their development plan

**Trend Calculation**:
```
if demand > supply * 1.5:
  trend = "increasing" (high shortage)
else if demand < supply * 0.5:
  trend = "decreasing" (oversupply)
else:
  trend = "stable"
```

## Report Endpoints

### Backend API Routes

```
GET /api/reports/dashboard
Returns: All report summaries for dashboard

GET /api/reports/student-readiness
Returns: All students' readiness scores
Params: ?export=pdf (optional)

GET /api/reports/student-readiness/:studentId
Returns: Individual student readiness report
Params: ?export=pdf (optional)

GET /api/reports/internship-match
Returns: Match analysis for all applications
Params: ?export=pdf (optional)

GET /api/reports/application-statistics
Returns: Application workflow metrics
Params: ?export=pdf (optional)

GET /api/reports/skills-demand
Returns: Skills market analysis
Params: ?export=pdf (optional)
```

### Response Format

```json
{
  "success": true,
  "data": [...],
  "timestamp": "2026-08-10T12:34:56.789Z"
}
```

## PDF Export Features

### Supported Exports
- Student Readiness Report (individual or aggregate)
- Internship Match Report (top matches)
- Application Statistics Report (with charts)
- Skills Demand Report (with trend analysis)

### PDF Structure
```
1. Header
   - Report Title
   - Report Type
   - Generated Date & Time

2. Executive Summary (Key metrics)

3. Detailed Data
   - Tables with data
   - Charts and visualizations
   - Trend analysis

4. Recommendations
   - Action items based on data
   - Suggested improvements

5. Footer
   - Report ID
   - Confidentiality notice (if applicable)
```

### Export API
```
Query Parameter: ?export=pdf
Response: Binary PDF file
Headers:
  Content-Type: application/pdf
  Content-Disposition: attachment; filename="report-name.pdf"
```

## Dashboard Analytics

### Real-time Dashboard Widgets

1. **Student Metrics Card**
   - Total Students: 1,234
   - Average Readiness Score: 72.5
   - New This Week: 45

2. **Application Metrics Card**
   - Total Applications: 5,678
   - Pending Review: 234
   - Acceptance Rate: 45%

3. **Skills Demand Card**
   - Skills Tracked: 156
   - High-Demand Skills: 12
   - Skills with Gap: 8

4. **Match Quality Card**
   - Average Match Score: 78%
   - Perfect Matches (95%+): 89
   - Poor Matches (<50%): 23

### Dashboard Refresh Rates
- Summary Stats: Real-time (updated on DB changes)
- Detailed Reports: On-demand
- Cached calculations: Every 6 hours
- PDF export: Generated on-demand

## Scheduling & Automation

### Scheduled Report Generation

```
Daily Reports (2:00 AM UTC):
- Application Statistics (previous day)
- Skills Demand Snapshot
- Email to Admin

Weekly Reports (Monday 6:00 AM UTC):
- Student Readiness Report
- Internship Match Report
- Trend Analysis
- Email to Stakeholders

Monthly Reports (1st of month, 6:00 AM UTC):
- Comprehensive Analytics Report
- Student Progress Report
- Employer Success Report
- Board Summary
```

### Report Distribution
- Email to authorized users
- Generate PDF exports
- Store in report archive
- Dashboard notification
- Push notification to mobile (if applicable)

## Filtering & Customization

### Report Filters

**Student Readiness Report**
```
- University
- Faculty/Department
- Year of Study
- GPA Range
- Skill Category
- Readiness Score Range
- Date Range
```

**Internship Match Report**
```
- Industry
- Location
- Remote/On-site
- Salary Range
- Position Type
- Application Status
- Match Score Range
- Date Range
```

**Application Statistics Report**
```
- Application Status
- Industry
- Company
- Student University
- Date Range
- Employer
```

**Skills Demand Report**
```
- Skill Category
- Demand Level
- Supply Level
- Trend
- Date Range
- Industry Filter
```

### Export Formats
- PDF (primary)
- CSV (planned)
- Excel (planned)
- JSON API (for external integration)

## Data Privacy & Security

### Access Control
- Role-based access (Admin > Employer > Student)
- Student data anonymized in aggregate reports
- Employer data restricted from competitors
- Audit logging for all report access

### Data Handling
```
Personal Data Included:
- Student names (admin only)
- Email addresses
- University affiliation
- Skills & proficiency

Anonymized Data:
- Aggregate statistics
- Trend analysis
- Benchmark comparisons
```

### GDPR Compliance
- Report generation logged
- User consent for data usage
- Right to be forgotten (data purged after X days)
- Data retention policy enforced

## Performance Optimization

### Query Optimization
- Indexed queries for fast report generation
- Materialized views for pre-computed metrics
- Caching layer for frequently accessed data
- Background calculation of readiness scores

### Report Generation Time
```
Student Readiness: 2-5 seconds
Internship Match: 3-8 seconds
Application Stats: 1-3 seconds
Skills Demand: 2-5 seconds
PDF Export: 5-15 seconds
```

### Caching Strategy
```
Cache Duration:
- Summary Stats: 1 hour
- Detailed Reports: 4 hours
- Metric Calculations: 6 hours
- PDF Exports: 24 hours

Cache Invalidation:
- On new application
- On skill update
- On profile changes
- Manual refresh by admin
```

## Troubleshooting

### Common Issues & Solutions

**Report returns empty data**
- Check date range filter
- Verify user permissions
- Confirm data exists for selected filters
- Check database connection

**PDF export fails**
- Ensure PDFKit is installed
- Check available disk space
- Verify file permissions
- Check server logs

**Report generation is slow**
- Check database query performance
- Review indexes on related tables
- Clear cache and regenerate
- Check server load

**Incorrect calculations**
- Verify formula implementation
- Check for null/undefined values
- Review data validation rules
- Compare against manual calculation

## Future Enhancements

### Planned Features
1. **Advanced Analytics**
   - Cohort analysis
   - Predictive analytics for placement success
   - Anomaly detection

2. **Reporting Engine**
   - Scheduled report generation
   - Email distribution
   - Custom report builder
   - Report templates

3. **Visualization**
   - Interactive dashboards
   - Real-time data updates
   - Data drill-down capabilities
   - Comparison views

4. **Export Options**
   - Excel with formatting
   - PowerPoint presentations
   - Interactive HTML reports
   - Email-optimized versions

5. **Integration**
   - API for third-party tools
   - BI tool integration (Tableau, Power BI)
   - Data warehouse export
   - Real-time data streaming

## API Integration Examples

### Fetching Student Readiness Report

```javascript
const response = await fetch('/api/reports/student-readiness', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data.data); // Array of student readiness records
```

### Exporting to PDF

```javascript
const response = await fetch('/api/reports/student-readiness?export=pdf', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  responseType: 'blob'
});

// Create download link
const url = window.URL.createObjectURL(response);
const a = document.createElement('a');
a.href = url;
a.download = 'readiness-report.pdf';
a.click();
```

### Filtering Reports

```javascript
// API supports query parameters for filtering
const params = new URLSearchParams({
  university: 'MIT',
  yearOfStudy: 3,
  minReadiness: 70,
  maxReadiness: 100,
  startDate: '2026-01-01',
  endDate: '2026-08-10'
});

const response = await fetch(`/api/reports/student-readiness?${params}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Best Practices

### For Administrators
1. Generate monthly comprehensive reports
2. Review trends and anomalies regularly
3. Share insights with stakeholders
4. Use reports for strategic planning
5. Archive important reports

### For Employers
1. Monitor application pipeline
2. Track match quality metrics
3. Review skills demand for hiring
4. Benchmark against industry standards
5. Export reports for hiring decisions

### For Students
1. Review personal readiness score
2. Identify skill gaps
3. Follow recommendations
4. Track application progress
5. Prepare for interviews

## Conclusion

The SkillSync reporting system provides comprehensive analytics supporting data-driven decision-making at all levels (admin, employer, student). With flexible filtering, multiple export formats, and real-time dashboards, the reporting system is a critical component for platform success.
