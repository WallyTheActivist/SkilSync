import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getApplicationStatusUpdateError,
  persistApplicationStatus,
} from '../src/utils/applicationStatusUpdate.mjs';

test('sends the selected application ID and enum status and displays the saved status', async () => {
  const requests = [];
  const displayedStatuses = [];
  const updateRequest = async (applicationId, status) => {
    requests.push({ applicationId, status });
    return { data: { data: { status: 'REJECTED' } } };
  };

  const savedStatus = await persistApplicationStatus(
    'application-123',
    'REJECTED',
    updateRequest,
    (status) => displayedStatuses.push(status),
  );

  assert.deepEqual(requests, [{ applicationId: 'application-123', status: 'REJECTED' }]);
  assert.equal(savedStatus, 'REJECTED');
  assert.deepEqual(displayedStatuses, ['REJECTED']);
});

test('does not replace the displayed status when the update request fails', async () => {
  const displayedStatuses = ['PENDING'];
  const updateRequest = async () => {
    const error = new Error('Request failed');
    error.response = { data: { message: 'Not authorized to update this application.' } };
    throw error;
  };

  await assert.rejects(
    persistApplicationStatus('application-123', 'REJECTED', updateRequest, (status) => displayedStatuses.push(status)),
    /Request failed/
  );

  assert.deepEqual(displayedStatuses, ['PENDING']);
});

test('uses the API validation detail for a failed application status update', () => {
  assert.equal(
    getApplicationStatusUpdateError({
      response: {
        data: {
          message: 'Invalid request data.',
          errors: ['status is invalid.'],
        },
      },
    }),
    'status is invalid.'
  );
});

test('uses the API error message when no validation details are returned', () => {
  assert.equal(
    getApplicationStatusUpdateError({ response: { data: { message: 'Not authorized to update this application.' } } }),
    'Not authorized to update this application.'
  );
});

test('uses a safe fallback when the error has no useful message', () => {
  assert.equal(getApplicationStatusUpdateError({}), 'Failed to update status. Please try again.');
});
