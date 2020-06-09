import { Normalize, Ability, Generics } from '@casl/ability';
import { Model, Page, QueryBuilderType, QueryBuilder } from 'objection';
import { toObjectionQuery } from './objection';

export declare type AnyObjectionAbility = Ability<any, any>;

const DENY_CONDITION_NAME = '__forbiddenByCasl__';

function emptifyQuery<M extends Model>(query: QueryBuilderType<M>) {
  query.where({ [DENY_CONDITION_NAME]: 1 });
  query.resolve([]);
  return query;
}

export interface AccessibleRecordsModel extends Model {
  new (...args: any[]): AccessibleRecordsModel;
  QueryBuilder: typeof QueryBuilder;
}

export function accessibleRecordsPlugin(subject: string) {
  if (!subject) {
    throw new TypeError('Cannot detect model name to return accessible records');
  }
  return function plugin<
    T extends AccessibleRecordsModel,
    U extends AnyObjectionAbility = AnyObjectionAbility
  >(
    ModelClass: T
  ): T {
    class CaslQueryBuilder<M extends Model, R = M[]> extends ModelClass.QueryBuilder<M, R> {
      ArrayQueryBuilderType!: CaslQueryBuilder<M, M[]>;
      SingleQueryBuilderType!: CaslQueryBuilder<M, M>;
      NumberQueryBuilderType!: CaslQueryBuilder<M, number>;
      PageQueryBuilderType!: CaslQueryBuilder<M, Page<M>>;

      accessibleBy(ability: AnyObjectionAbility, action?: Normalize<Generics<U>['abilities']>[0]) {
        const toQuery = toObjectionQuery as (...args: any[]) => ReturnType<typeof toObjectionQuery>;
        const query = toQuery(this, ability, subject, action);
        if (query === null) {
          return emptifyQuery(this as unknown as QueryBuilderType<M>);
        }
        return this;
      }
    }

    return class AccessibleRecordsModel extends ModelClass {
      QueryBuilderType!: CaslQueryBuilder<this>;
      static QueryBuilder = CaslQueryBuilder;
    };
  };
}
