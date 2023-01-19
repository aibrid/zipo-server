const verificationMail = (token) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
  <p>Please verify your email by clicking the link below. Kindly ignore this email if you did not initiate this request</p>
  <br>
  <p><a href="https://zipo.me/#/verify-token/${token}">Verify Email</a></p>
  </body>
</html>
`;

module.exports = { verificationMail };
