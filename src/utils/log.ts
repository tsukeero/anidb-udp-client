
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {}

const { NODE_ENV, DEBUG } = process.env

const withLevel = (level: string, logFn: (...args: any)=>void) => (...args: any) => logFn(level, ...args)


export type AnidbLoggerType = {
  info: (message?: any, ...optionalParams: any[]) => void;
  error: (message?: any, ...optionalParams: any[]) => void;
  warn: (message?: any, ...optionalParams: any[]) => void;
  debug: (message?: any, ...optionalParams: any[]) => void;
}

const LOGGER: AnidbLoggerType = {
  info: console.info,
  error: console.error,
  warn: console.warn,
  debug: NODE_ENV === 'development' || NODE_ENV === 'test' || DEBUG ? withLevel('[ANIDB] Debug: ', console.info) : noop as typeof console.debug, // only let debug log if env is development or DEBUG is enabled
}

export const forceEnableDebugLog = () => {
  LOGGER.debug = withLevel('[ANIDB] Debug: ', console.info)
}

export const setLog = (logger?: AnidbLoggerType) => {
  if (!logger) {
    // if logger passed as undefined, disable log
    for (const key of Object.keys(LOGGER)) {
      LOGGER[key as keyof typeof LOGGER] = noop
    }
  } else {
    for (const key of Object.keys(LOGGER)) {
      const d = key as keyof typeof LOGGER
      if (!logger[d]) {
        LOGGER[d] = noop
      } else {
        LOGGER[d] = logger[d].bind(logger)
      }
    }
  }
}

export default LOGGER