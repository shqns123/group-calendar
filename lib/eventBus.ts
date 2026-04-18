type Subscriber = (groupId: string) => void;

const subscribers = new Set<Subscriber>();

export const eventBus = {
  subscribe(fn: Subscriber) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
  notify(groupId: string) {
    subscribers.forEach((fn) => fn(groupId));
  },
};
