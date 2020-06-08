import { defineAbility } from '@casl/ability'
import Knex from 'knex'
import isFunction from 'lodash/isFunction'
import { rulesToKnexQuery } from '../src'

const knex = Knex({ client: 'sqlite3' })


function compileCallback(callback, method = 'where') {
  const { client } = knex
  const builder = client.queryBuilder()
  callback.call(builder, builder)
  const compiler = client.queryCompiler(builder)
  return compiler.grouped[method].map(
    sttm => isFunction(sttm.value) ? compileCallback(sttm.value) : sttm
  )
}

function rulesToStatements(...args) {
  const builder = rulesToKnexQuery(...args)
  return builder && builder._statements.map((sttm) => {
    if (sttm.type === 'whereWrapped') return compileCallback(sttm.value)
    return sttm
  })
}
describe('rulesToKnexQuery', () => {
  it('returns query builder with no where conditions', () => {
    const ability = defineAbility(can => can('read', 'Post'))
    const statements = rulesToStatements(ability, 'read', 'Post')

    expect(statements).to.deep.equal([
      { grouping: 'columns', value: ['*'] }
    ])
  })

  it('returns no where conditions if empty `Ability` instance is passed', () => {
    const ability = defineAbility(() => {})
    const statements = rulesToStatements(ability, 'read', 'Post')

    expect(statements).to.be.null
  })

  it('returns empty conditions if at least one regular rule does not have conditions', () => {
    const ability = defineAbility((can) => {
      can('read', 'Post', { author: 123 })
      can('read', 'Post')
    })
    const statements = rulesToStatements(ability, 'read', 'Post')

    expect(statements).to.deep.equal([
      { grouping: 'columns', value: ['*'] }
    ])
  })

  it('returns whereNot query for inverted rules', () => {
    const ability = defineAbility((can, cannot) => {
      cannot('read', 'Post', { private: true })
    })
    const statements = rulesToStatements(ability, 'read', 'Post')

    expect(statements).to.deep.equal([
      { grouping: 'columns', value: ['*'] },
      { grouping: 'where',
        type: 'whereBasic',
        column: 'private',
        operator: '=',
        value: true,
        not: true,
        bool: 'and',
        asColumn: false }
    ])
  })

  it('returns `null` if at least one inverted rule does not have conditions', () => {
    const ability = defineAbility((can, cannot) => {
      cannot('read', 'Post', { author: 123 })
      cannot('read', 'Post')
    })
    const statements = rulesToStatements(ability, 'read', 'Post')

    expect(statements).to.be.null
  })

  it('returns `null` if at least one inverted rule does not have conditions even if direct condition exists', () => {
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', { public: true })
      cannot('read', 'Post', { author: 321 })
      cannot('read', 'Post')
    })
    const statements = rulesToStatements(ability, 'read', 'Post')

    expect(statements).to.be.null
  })

  it('returns non-`null` if there is at least one regular rule after last inverted one without conditions', () => {
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', { public: true })
      cannot('read', 'Post', { author: 321 })
      cannot('read', 'Post')
      can('read', 'Post', { author: 123 })
    })
    const statements = rulesToStatements(ability, 'read', 'Post')
    expect(statements).to.deep.equal([
      { grouping: 'columns', value: ['*'] },
      [[{
        grouping: 'where',
        type: 'whereBasic',
        column: 'author',
        operator: '=',
        value: 123,
        not: false,
        bool: 'and',
        asColumn: false
      }]]
    ])
  })


  it('OR-es conditions for regular rules', () => {
    const ability = defineAbility((can) => {
      can('read', 'Post', { status: 'draft', createdBy: 'someoneelse' })
      can('read', 'Post', { status: 'published', createdBy: 'me' })
    })
    const statements = rulesToStatements(ability, 'read', 'Post')
    expect(statements).to.deep.equal([
      { grouping: 'columns', value: ['*'] },
      [
        [{
          grouping: 'where',
          type: 'whereBasic',
          column: 'status',
          operator: '=',
          value: 'published',
          not: false,
          bool: 'and',
          asColumn: false
        },
        {
          grouping: 'where',
          type: 'whereBasic',
          column: 'createdBy',
          operator: '=',
          value: 'me',
          not: false,
          bool: 'and',
          asColumn: false
        }],
        [{
          grouping: 'where',
          type: 'whereBasic',
          column: 'status',
          operator: '=',
          value: 'draft',
          not: false,
          bool: 'and',
          asColumn: false
        }, {
          grouping: 'where',
          type: 'whereBasic',
          column: 'createdBy',
          operator: '=',
          value: 'someoneelse',
          not: false,
          bool: 'and',
          asColumn: false
        }]
      ]
    ])
  })

  it('AND-es conditions for inverted rules', () => {
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post')
      cannot('read', 'Post', { status: 'draft', createdBy: 'someoneelse' })
      cannot('read', 'Post', { status: 'published', createdBy: 'me' })
    })
    const statements = rulesToStatements(ability, 'read', 'Post')
    expect(statements).to.deep.equal([
      { grouping: 'columns', value: ['*'] },
      {
        grouping: 'where',
        type: 'whereBasic',
        column: 'status',
        operator: '=',
        value: 'published',
        not: true,
        bool: 'and',
        asColumn: false
      },
      {
        grouping: 'where',
        type: 'whereBasic',
        column: 'createdBy',
        operator: '=',
        value: 'me',
        not: true,
        bool: 'and',
        asColumn: false
      },
      {
        grouping: 'where',
        type: 'whereBasic',
        column: 'status',
        operator: '=',
        value: 'draft',
        not: true,
        bool: 'and',
        asColumn: false
      },
      {
        grouping: 'where',
        type: 'whereBasic',
        column: 'createdBy',
        operator: '=',
        value: 'someoneelse',
        not: true,
        bool: 'and',
        asColumn: false
      }
    ])
  })

  it('OR-es conditions for regular rules and AND-es for inverted ones', () => {
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', { _id: 'mega' })
      can('read', 'Post', { state: 'draft' })
      cannot('read', 'Post', { private: true })
      cannot('read', 'Post', { state: 'archived' })
    })
    const statements = rulesToStatements(ability, 'read', 'Post')
    expect(statements).to.deep.equal([
      { grouping: 'columns', value: ['*'] },
      {
        grouping: 'where',
        type: 'whereBasic',
        column: 'state',
        operator: '=',
        value: 'archived',
        not: true,
        bool: 'and',
        asColumn: false
      },
      {
        grouping: 'where',
        type: 'whereBasic',
        column: 'private',
        operator: '=',
        value: true,
        not: true,
        bool: 'and',
        asColumn: false
      },
      [[{
        grouping: 'where',
        type: 'whereBasic',
        column: 'state',
        operator: '=',
        value: 'draft',
        not: false,
        bool: 'and',
        asColumn: false
      }],
      [{
        grouping: 'where',
        type: 'whereBasic',
        column: '_id',
        operator: '=',
        value: 'mega',
        not: false,
        bool: 'and',
        asColumn: false
      }]]
    ])
  })

  it('returns empty where if inverted rule with conditions defined before regular rule without conditions', () => {
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', { author: 123 })
      cannot('read', 'Post', { private: true })
      can('read', 'Post')
    })
    const statements = rulesToStatements(ability, 'read', 'Post')

    expect(statements).to.deep.equal([
      { grouping: 'columns', value: ['*'] }
    ])
  })
})
