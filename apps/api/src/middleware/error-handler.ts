import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  void next;

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({
      error: 'Invalid JSON body.',
    });
    return;
  }

  response.status(500).json({
    error: 'Internal server error.',
  });
};
