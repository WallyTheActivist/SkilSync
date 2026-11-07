const MAX_ERROR_MESSAGE_LENGTH = 300;

export const persistApplicationStatus = async (applicationId, status, updateRequest, onSaved) => {
  const response = await updateRequest(applicationId, status);
  const savedStatus = response?.data?.data?.status;
  if (typeof savedStatus !== 'string') {
    throw new Error('The server did not return the saved application status.');
  }

  onSaved(savedStatus);
  return savedStatus;
};

export const getApplicationStatusUpdateError = (error) => {
  const responseData = error?.response?.data;
  const details = responseData?.errors;
  if (Array.isArray(details)) {
    const message = details.find((detail) =>
      typeof detail === 'string' && detail.trim() && detail.length <= MAX_ERROR_MESSAGE_LENGTH
    );
    if (message) return message;
  }

  const responseMessage = responseData?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim() && responseMessage.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return responseMessage;
  }

  const errorMessage = error?.message;
  if (typeof errorMessage === 'string' && errorMessage.trim() && errorMessage.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return errorMessage;
  }

  return 'Failed to update status. Please try again.';
};
