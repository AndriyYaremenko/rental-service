export class DomainError extends Error {}

export class InvalidAmountError extends DomainError {}

export class NoPreviousReadingError extends DomainError {
  constructor() {
    super('Немає попереднього показника лічильника')
  }
}

export class NegativeConsumptionError extends DomainError {
  constructor(used: string) {
    super(`Споживання не може бути відʼємним: ${used}`)
  }
}
