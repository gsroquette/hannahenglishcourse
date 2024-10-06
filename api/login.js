export default function handler(req, res) {
  if (req.method === 'POST') {
    const { username, password } = req.body;

    // Simulação simples de login. No futuro, você pode conectar a um banco de dados para autenticar.
    if (username === 'admin' && password === 'admin123') {
      res.status(200).json({ message: 'Login successful', user: username });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
