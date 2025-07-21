# Unblocked AI CLI

Unblocked AI comes with a built-in CLI to help you manage the database schema needed for AI conversations, documents, and core functionality.


### **Init**

The CLI includes an `init` command to add Unblocked AI to your project.

```bash title="terminal"
npx @unblocked/cli@latest init
```

### **Generate**

The `generate` command creates the schema required by Unblocked AI. If you're using a database adapter like Prisma or Drizzle, this command will generate the right schema for your ORM. If you're using the built-in Kysely adapter, it will generate an SQL file you can run directly on your database.

```bash title="terminal"
npx @unblocked/cli@latest generate
```

### **Migrate**

The `migrate` command applies the Unblocked AI schema directly to your database. This is available if you're using the built-in Kysely adapter. For other adapters, you'll need to apply the schema using your ORM's migration tool.

```bash title="terminal"
npx @unblocked/cli@latest migrate
```

### **Providers**

The CLI provides a way to setup AI provider API keys for your Unblocked AI instance.

```bash title="terminal"
npx @unblocked/cli@latest providers
```

### **Secret**

The CLI also provides a way to generate a secret key for your Unblocked AI instance.

```bash title="terminal"
npx @unblocked/cli@latest secret
```


## License

MIT
