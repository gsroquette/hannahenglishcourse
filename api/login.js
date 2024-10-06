export default function handler(req, res) {
  if (req.method === 'POST') {
    const { username, password } = req.body;

    // Simulação simples de login. No futuro, conecte isso a um banco de dados.
    const users = [
      { username: 'admin', password: 'admin123' }, // Simulação de usuários
      { username: 'user1', password: 'password1' }
    ];

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      res.status(200).json({ message: 'Login successful', user: username });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
