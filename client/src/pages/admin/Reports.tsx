import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Spinner, Alert, Badge } from 'react-bootstrap';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Download, TrendingUp, Users, Briefcase, Zap } from 'lucide-react';
import {
  ApplicationReportData,
  DashboardReportData,
  MatchReportData,
  ReportsService,
  SkillDemandData,
  StudentReadinessData,
} from '../../services/reportsService';
import toast from 'react-hot-toast';

const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9'];

export default function ReportsPage() {
  const [dashboardData, setDashboardData] = useState<DashboardReportData | null>(null);
  const [readinessReport, setReadinessReport] = useState<StudentReadinessData[]>([]);
  const [matchReport, setMatchReport] = useState<MatchReportData[]>([]);
  const [applicationReport, setApplicationReport] = useState<ApplicationReportData | null>(null);
  const [skillsReport, setSkillsReport] = useState<SkillDemandData[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'readiness' | 'match' | 'applications' | 'skills'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') return;
    let isCurrent = true;
    setReportLoading(true);
    setReportError(null);

    const loadReport = async () => {
      try {
        switch (activeTab) {
          case 'readiness':
            setReadinessReport(await ReportsService.getStudentReadinessReport());
            break;
          case 'match':
            setMatchReport(await ReportsService.getInternshipMatchReport());
            break;
          case 'applications':
            setApplicationReport(await ReportsService.getApplicationStatisticsReport());
            break;
          case 'skills':
            setSkillsReport(await ReportsService.getSkillsDemandReport());
            break;
        }
      } catch {
        if (isCurrent) setReportError('Failed to load this report.');
      } finally {
        if (isCurrent) setReportLoading(false);
      }
    };

    void loadReport();
    return () => { isCurrent = false; };
  }, [activeTab]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ReportsService.getDashboardData();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async (reportType: 'readiness' | 'match' | 'applications' | 'skills') => {
    try {
      setExporting(reportType);
      await ReportsService.exportToPDF(reportType);
      toast.success(`${reportType} report exported successfully`);
    } catch (err) {
      toast.error(`Failed to export ${reportType} report`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <Container fluid className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="admin-reports">
      {/* Page Header */}
      <div className="admin-page-heading">
        <h1 className="admin-page-title">Reports & Analytics</h1>
        <p className="admin-page-subtitle">Comprehensive insights into student readiness, internship matches, and skills demand</p>
      </div>

      {/* Tabs */}
      <div className="btn-group mb-4" role="group" aria-label="Report sections">
        <button
          type="button"
          className={`btn btn-outline-primary ${activeTab === 'overview' ? 'active' : ''}`}
          aria-pressed={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`btn btn-outline-primary ${activeTab === 'readiness' ? 'active' : ''}`}
          aria-pressed={activeTab === 'readiness'}
          onClick={() => setActiveTab('readiness')}
        >
          Student Readiness
        </button>
        <button
          type="button"
          className={`btn btn-outline-primary ${activeTab === 'match' ? 'active' : ''}`}
          aria-pressed={activeTab === 'match'}
          onClick={() => setActiveTab('match')}
        >
          Internship Match
        </button>
        <button
          type="button"
          className={`btn btn-outline-primary ${activeTab === 'applications' ? 'active' : ''}`}
          aria-pressed={activeTab === 'applications'}
          onClick={() => setActiveTab('applications')}
        >
          Applications
        </button>
        <button
          type="button"
          className={`btn btn-outline-primary ${activeTab === 'skills' ? 'active' : ''}`}
          aria-pressed={activeTab === 'skills'}
          onClick={() => setActiveTab('skills')}
        >
          Skills Demand
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboardData && (
        <>
          {/* Stats Cards */}
          <Row className="mb-4 g-4">
            <Col md={6} lg={3}>
              <Card className="stat-card">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="stat-value">{dashboardData.studentReadiness.total}</div>
                      <div className="stat-label">Student Profiles</div>
                    </div>
                    <Users size={32} className="text-primary opacity-50" />
                  </div>
                  <div className="stat-change positive mt-2">
                    Avg last-recorded score: {dashboardData.studentReadiness.total > 0
                      ? `${dashboardData.studentReadiness.averageScore.toFixed(1)}/100`
                      : 'Unavailable'}
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={3}>
              <Card className="stat-card success">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="stat-value">{dashboardData.applicationStats.totalApplications}</div>
                      <div className="stat-label">Applications</div>
                    </div>
                    <Briefcase size={32} className="text-success opacity-50" />
                  </div>
                  <div className="stat-change positive mt-2">
                    Acceptance Rate: {dashboardData.applicationStats.acceptanceRate}%
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={3}>
              <Card className="stat-card warning">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="stat-value">{dashboardData.skillsDemand.total}</div>
                      <div className="stat-label">Skills Tracked</div>
                    </div>
                    <Zap size={32} className="text-warning opacity-50" />
                  </div>
                  <div className="stat-change positive mt-2">
                    {dashboardData.skillsDemand.highDemandGaps.filter((skill) => skill.demandPressure === 'high').length} High-Demand Skills
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={3}>
              <Card className="stat-card">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <div className="stat-value">{dashboardData.internshipMatch.total}</div>
                      <div className="stat-label">Application Match Records</div>
                    </div>
                    <TrendingUp size={32} className="text-info opacity-50" />
                  </div>
                  <div className="stat-change positive mt-2">
                    Avg application-time match: {dashboardData.internshipMatch.averageMatch === null
                      ? 'Unavailable'
                      : `${dashboardData.internshipMatch.averageMatch.toFixed(0)}%`}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Charts */}
          <Row className="mb-4 g-4">
            <Col lg={6}>
              <Card>
                <Card.Header>
                  <Card.Title className="mb-0">Applications by Status</Card.Title>
                </Card.Header>
                <Card.Body>
                  {Object.keys(dashboardData.applicationStats.byStatus).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(dashboardData.applicationStats.byStatus).map(([status, count]) => ({
                            name: status,
                            value: count,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {colors.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted">No data available</p>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col lg={6}>
              <Card>
                <Card.Header>
                  <Card.Title className="mb-0">Top Internship Positions</Card.Title>
                </Card.Header>
                <Card.Body>
                  {dashboardData.applicationStats.topInternships.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={dashboardData.applicationStats.topInternships.slice(0, 8)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="applications" fill="#2563EB" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted">No data available</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* High Demand Skills */}
          <Card className="mb-4">
            <Card.Header>
              <Card.Title className="mb-0">Skills with Highest Demand Gaps</Card.Title>
            </Card.Header>
            <Card.Body>
              {dashboardData.skillsDemand.highDemandGaps.length === 0 ? (
                <p className="text-center text-muted my-3">No high-demand skills to display yet.</p>
              ) : (
                <Table hover responsive>
                  <thead>
                    <tr>
                      <th>Skill Name</th>
                      <th>Category</th>
                      <th>Demand Count</th>
                      <th>Available Students</th>
                      <th>Gap</th>
                      <th>Demand Pressure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.skillsDemand.highDemandGaps.map((skill) => (
                      <tr key={skill.skillName}>
                        <td className="fw-bold">{skill.skillName}</td>
                        <td>
                          <Badge bg="info">{skill.category}</Badge>
                        </td>
                        <td>{skill.demandCount}</td>
                        <td>{skill.availableStudents}</td>
                        <td className="text-danger fw-bold">{skill.gap}</td>
                        <td>
                          <Badge
                            bg={skill.demandPressure === 'high' ? 'danger' : skill.demandPressure === 'low' ? 'success' : 'warning'}
                          >
                            {skill.demandPressure}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </>
      )}

      {/* Student Readiness Tab */}
      {activeTab === 'readiness' && (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <Card.Title className="mb-0">Student Readiness Report</Card.Title>
            <Button
              variant="primary"
              size="sm"
              disabled={exporting === 'readiness'}
              onClick={() => handleExportPDF('readiness')}
            >
              <Download size={16} className="me-2" />
              {exporting === 'readiness' ? 'Exporting...' : 'Export PDF'}
            </Button>
          </Card.Header>
          <Card.Body>
            <p className="text-muted">Scores are the last readiness values saved on each student profile, not recalculated by this report.</p>
            {reportLoading ? <Spinner animation="border" size="sm" /> : reportError ? (
              <Alert variant="danger">{reportError}</Alert>
            ) : readinessReport.length === 0 ? (
              <p className="text-muted mb-0">No student profiles found.</p>
            ) : (
              <Table responsive hover>
                <thead><tr><th>Student</th><th>Last-Recorded Readiness</th><th>Skills</th><th>Applications</th></tr></thead>
                <tbody>
                  {readinessReport.map((student) => (
                    <tr key={student.id}>
                      <td>{student.firstName} {student.lastName}</td>
                      <td>{student.readinessScore}/100</td>
                      <td>{student.skillCount}</td>
                      <td>{student.applicationCount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Internship Match Tab */}
      {activeTab === 'match' && (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <Card.Title className="mb-0">Internship Match Report</Card.Title>
            <Button
              variant="primary"
              size="sm"
              disabled={exporting === 'match'}
              onClick={() => handleExportPDF('match')}
            >
              <Download size={16} className="me-2" />
              {exporting === 'match' ? 'Exporting...' : 'Export PDF'}
            </Button>
          </Card.Header>
          <Card.Body>
            <p className="text-muted">Match scores are snapshots captured when applications were submitted.</p>
            {reportLoading ? <Spinner animation="border" size="sm" /> : reportError ? (
              <Alert variant="danger">{reportError}</Alert>
            ) : matchReport.length === 0 ? (
              <p className="text-muted mb-0">No application match records found.</p>
            ) : (
              <Table responsive hover>
                <thead><tr><th>Student</th><th>Internship</th><th>Company</th><th>Match at Application</th><th>Status</th></tr></thead>
                <tbody>
                  {matchReport.map((match) => (
                    <tr key={match.applicationId}>
                      <td>{match.studentName}</td>
                      <td>{match.internshipTitle}</td>
                      <td>{match.companyName}</td>
                      <td>{match.matchPercentage === null ? 'Unavailable' : `${match.matchPercentage}%`}</td>
                      <td>{match.status}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <Card.Title className="mb-0">Application Statistics Report</Card.Title>
            <Button
              variant="primary"
              size="sm"
              disabled={exporting === 'applications'}
              onClick={() => handleExportPDF('applications')}
            >
              <Download size={16} className="me-2" />
              {exporting === 'applications' ? 'Exporting...' : 'Export PDF'}
            </Button>
          </Card.Header>
          <Card.Body>
            {reportLoading ? <Spinner animation="border" size="sm" /> : reportError ? (
              <Alert variant="danger">{reportError}</Alert>
            ) : applicationReport ? (
              <>
                <p>
                  {applicationReport.totalApplications} applications · {applicationReport.acceptanceRate}% accepted
                  · Average decision time: {applicationReport.averageTimeToDecision === null
                    ? 'Unavailable (no decision timestamp is recorded)'
                    : `${applicationReport.averageTimeToDecision} days`}
                </p>
                <Row>
                  <Col md={6}>
                    <h6>Applications by status</h6>
                    {Object.keys(applicationReport.byStatus).length === 0 ? <p className="text-muted">No applications found.</p> : (
                      <Table size="sm"><tbody>
                        {Object.entries(applicationReport.byStatus).map(([status, count]) => (
                          <tr key={status}><td>{status}</td><td>{count}</td></tr>
                        ))}
                      </tbody></Table>
                    )}
                  </Col>
                  <Col md={6}>
                    <h6>Top internships by application count</h6>
                    {applicationReport.topInternships.length === 0 ? <p className="text-muted">No applications found.</p> : (
                      <Table size="sm"><tbody>
                        {applicationReport.topInternships.map((internship) => (
                          <tr key={internship.title}><td>{internship.title}</td><td>{internship.applications}</td></tr>
                        ))}
                      </tbody></Table>
                    )}
                  </Col>
                </Row>
              </>
            ) : <p className="text-muted mb-0">No application report data.</p>}
          </Card.Body>
        </Card>
      )}

      {/* Skills Demand Tab */}
      {activeTab === 'skills' && (
        <Card>
          <Card.Header className="d-flex justify-content-between align-items-center">
            <Card.Title className="mb-0">Skills Demand Report</Card.Title>
            <Button
              variant="primary"
              size="sm"
              disabled={exporting === 'skills'}
              onClick={() => handleExportPDF('skills')}
            >
              <Download size={16} className="me-2" />
              {exporting === 'skills' ? 'Exporting...' : 'Export PDF'}
            </Button>
          </Card.Header>
          <Card.Body>
            <p className="text-muted">Demand counts include requirements on active internships; availability counts student skill records.</p>
            {reportLoading ? <Spinner animation="border" size="sm" /> : reportError ? (
              <Alert variant="danger">{reportError}</Alert>
            ) : skillsReport.length === 0 ? (
              <p className="text-muted mb-0">No skills found.</p>
            ) : (
              <Table responsive hover>
                <thead><tr><th>Skill</th><th>Category</th><th>Active Listing Requirements</th><th>Student Records</th><th>Demand Gap</th><th>Demand Pressure</th></tr></thead>
                <tbody>
                  {skillsReport.map((skill) => (
                    <tr key={skill.skillName}>
                      <td>{skill.skillName}</td>
                      <td>{skill.category}</td>
                      <td>{skill.demandCount}</td>
                      <td>{skill.availableStudents}</td>
                      <td>{skill.gap}</td>
                      <td><Badge bg={skill.demandPressure === 'high' ? 'danger' : skill.demandPressure === 'low' ? 'success' : 'warning'}>{skill.demandPressure}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}
