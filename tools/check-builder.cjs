require('./check-app.cjs').check().catch(error=>{console.error(error);process.exitCode=1;});
