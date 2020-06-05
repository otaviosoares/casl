import { AnyAbility, Subject } from '@casl/ability';

interface RulesToObjetionOptions {
  isRelation(field: string, subject: Subject, ability: AnyAbility): boolean
}

export function rulesToObjectionQuery(ability: AnyAbility, action: string, subject: Subject, options: RulesToObjetionOptions) {
  // TODO
}
