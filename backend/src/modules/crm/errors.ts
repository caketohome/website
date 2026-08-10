export class CustomerNotFoundError extends Error {
  public code = "CUSTOMER_NOT_FOUND";
  public status = 404;

  constructor(customerId: string) {
    super(`Customer with ID ${customerId} not found.`);
    this.name = "CustomerNotFoundError";
  }
}

export class NoteNotFoundError extends Error {
  public code = "NOTE_NOT_FOUND";
  public status = 404;

  constructor(noteId: string) {
    super(`Note with ID ${noteId} not found.`);
    this.name = "NoteNotFoundError";
  }
}

export class NotePermissionError extends Error {
  public code = "NOTE_PERMISSION_DENIED";
  public status = 403;

  constructor(message = "You do not have permission to perform this action on the note.") {
    super(message);
    this.name = "NotePermissionError";
  }
}

export class NoteValidationError extends Error {
  public code = "NOTE_VALIDATION_FAILED";
  public status = 400;

  constructor(message: string) {
    super(message);
    this.name = "NoteValidationError";
  }
}

export class CampaignNotFoundError extends Error {
  public code = "CAMPAIGN_NOT_FOUND";
  public status = 404;

  constructor(campaignId: string) {
    super(`Campaign with ID ${campaignId} not found.`);
    this.name = "CampaignNotFoundError";
  }
}

export class CampaignValidationError extends Error {
  public code = "CAMPAIGN_VALIDATION_FAILED";
  public status = 400;

  constructor(message: string) {
    super(message);
    this.name = "CampaignValidationError";
  }
}

export class CampaignArchivedError extends Error {
  public code = "CAMPAIGN_ARCHIVED";
  public status = 400;

  constructor(campaignId: string, message = `Campaign with ID ${campaignId} is archived and cannot be updated.`) {
    super(message);
    this.name = "CampaignArchivedError";
  }
}

export class SegmentNotFoundError extends Error {
  public code = "SEGMENT_NOT_FOUND";
  public status = 404;

  constructor(segmentId: string) {
    super(`Segment with ID ${segmentId} not found.`);
    this.name = "SegmentNotFoundError";
  }
}

export class SegmentValidationError extends Error {
  public code = "SEGMENT_VALIDATION_FAILED";
  public status = 400;

  constructor(message: string) {
    super(message);
    this.name = "SegmentValidationError";
  }
}

export class TemplateNotFoundError extends Error {
  public code = "TEMPLATE_NOT_FOUND";
  public status = 404;

  constructor(templateId: string) {
    super(`Template with ID ${templateId} not found.`);
    this.name = "TemplateNotFoundError";
  }
}

export class TemplateValidationError extends Error {
  public code = "TEMPLATE_VALIDATION_FAILED";
  public status = 400;

  constructor(message: string) {
    super(message);
    this.name = "TemplateValidationError";
  }
}
