import { ITraceSink } from './trace-sink.interface';

let globalTraceSink: ITraceSink | null = null;

export function setGlobalTraceSink(sink: ITraceSink | null) {
  globalTraceSink = sink;
}

export function getGlobalTraceSink(): ITraceSink | null {
  return globalTraceSink;
}
