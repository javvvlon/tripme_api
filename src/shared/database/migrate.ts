import 'reflect-metadata'
import dataSource from './data-source'

/**
 * @author Javlon Khalimjonov <khalimjanov2000@gmail.com>
 */
async function main(): Promise<void> {
  const revert = process.argv.includes('--revert')

  await dataSource.initialize()

  try {
    if (revert) {
      await dataSource.undoLastMigration({ transaction: 'all' })
      console.log('reverted the last migration')

      return
    }

    const applied = await dataSource.runMigrations({ transaction: 'all' })

    console.log(
      applied.length
        ? `applied ${applied.length} migration(s): ${applied.map(m => m.name).join(', ')}`
        : 'schema already up to date',
    )
  }
  finally {
    await dataSource.destroy()
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
