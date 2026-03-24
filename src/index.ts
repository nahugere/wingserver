import express, { Application, Request, Response } from 'express';
import apiRoute from './routes/api.js';

const app: Application = express();
const port = process.env.PORT || 3000;

app.use(express.json())
app.use("/api", apiRoute)

app.get('/', (req: Request, res: Response) => {
    res.send('Welcome to the mainpage!');
});

app.listen(port, () => {
    console.log(`Server running on port: ${port}`)
})

export default app;