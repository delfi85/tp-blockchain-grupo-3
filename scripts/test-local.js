const hre = require("hardhat");

async function main() {
  console.log("🚀 Iniciando demostración completa del contrato MiContrato...\n");

  // Compilar el contrato
  console.log("📦 Compilando contrato...");
  await hre.run("compile");

  // Desplegar el contrato
  console.log("🚢 Desplegando contrato...");
  const MiContrato = await hre.ethers.getContractFactory("MiContrato");
  const contrato = await MiContrato.deploy();
  await contrato.waitForDeployment();

  const address = await contrato.getAddress();
  console.log("✅ MiContrato desplegado en:", address);
  console.log("");

  // Obtener cuentas para las pruebas
  const [owner, usuario1, usuario2] = await hre.ethers.getSigners();
  console.log("👤 Owner (deployer):", owner.address);
  console.log("👤 Usuario 1:", usuario1.address);
  console.log("👤 Usuario 2:", usuario2.address);
  console.log("");

  // === DEMOSTRACIÓN DE FUNCIONALIDADES ===
  console.log("🧪 === DEMOSTRACIÓN DE FUNCIONALIDADES ===\n");

  // 1. Información inicial del contrato
  console.log("1️⃣ Información inicial del contrato:");
  const [saludoInicial, ownerInicial, contadorInicial] = await contrato.getInfoContrato();
  console.log(`   Saludo: "${saludoInicial}"`);
  console.log(`   Owner: ${ownerInicial}`);
  console.log(`   Contador: ${contadorInicial}`);
  console.log("");

  // 2. Cambiar saludo global (desde owner)
  console.log("2️⃣ Owner cambia el saludo global:");
  const tx1 = await contrato.setSaludo("¡Hola desde el desarrollo local!");
  await tx1.wait();
  console.log(`   Nuevo saludo: "${await contrato.saludo()}"`);
  console.log(`   Hash de transacción: ${tx1.hash}`);
  console.log("");

  // 3. Owner crea mensaje personal
  console.log("3️⃣ Owner crea un mensaje personal:");
  const tx2 = await contrato.setMensajePersonal("Soy el creador de este contrato");
  await tx2.wait();
  const [mensajeOwner, interaccionesOwner] = await contrato.getInfoUsuario(owner.address);
  console.log(`   Mensaje personal: "${mensajeOwner}"`);
  console.log(`   Interacciones: ${interaccionesOwner}`);
  console.log("");

  // 4. Owner incrementa contador (función exclusiva)
  console.log("4️⃣ Owner incrementa el contador:");
  const tx3 = await contrato.incrementarContador();
  await tx3.wait();
  console.log(`   Contador actualizado: ${await contrato.contador()}`);
  console.log("");

  // 5. Usuario 1 interactúa
  console.log("5️⃣ Usuario 1 interactúa con el contrato:");
  const contratoUsuario1 = contrato.connect(usuario1);

  const tx4 = await contratoUsuario1.setSaludo("Saludo desde Usuario 1");
  await tx4.wait();
  console.log(`   Usuario 1 cambió el saludo a: "${await contrato.saludo()}"`);

  const tx5 = await contratoUsuario1.setMensajePersonal("Mensaje personal del Usuario 1");
  await tx5.wait();
  const [mensajeU1, interaccionesU1] = await contrato.getInfoUsuario(usuario1.address);
  console.log(`   Mensaje personal: "${mensajeU1}"`);
  console.log(`   Interacciones: ${interaccionesU1}`);
  console.log("");

  // 6. Usuario 2 intenta incrementar contador (debería fallar)
  console.log("6️⃣ Usuario 2 intenta incrementar contador (debería fallar):");
  const contratoUsuario2 = contrato.connect(usuario2);
  try {
    await contratoUsuario2.incrementarContador();
    console.log("   ❌ ERROR: El usuario no debería poder incrementar");
  } catch (error) {
    console.log("   ✅ Correcto: Solo el owner puede incrementar");
    console.log(`   Error: ${error.reason}`);
  }
  console.log("");

  // 7. Usuario 2 crea su mensaje personal
  console.log("7️⃣ Usuario 2 crea su mensaje personal:");
  const tx6 = await contratoUsuario2.setMensajePersonal("¡Hola desde Usuario 2!");
  await tx6.wait();
  const [mensajeU2, interaccionesU2] = await contrato.getInfoUsuario(usuario2.address);
  console.log(`   Mensaje personal: "${mensajeU2}"`);
  console.log(`   Interacciones: ${interaccionesU2}`);
  console.log("");

  // 8. Estado final del contrato
  console.log("8️⃣ Estado final del contrato:");
  const [saludoFinal, ownerFinal, contadorFinal, bloqueFinal] = await contrato.getInfoContrato();
  console.log(`   Saludo actual: "${saludoFinal}"`);
  console.log(`   Owner: ${ownerFinal}`);
  console.log(`   Contador: ${contadorFinal}`);
  console.log(`   Bloque actual: ${bloqueFinal}`);
  console.log("");

  // 9. Resumen de interacciones por usuario
  console.log("9️⃣ Resumen de interacciones:");
  console.log(`   Owner (${owner.address.slice(0,6)}...): ${interaccionesOwner} interacciones`);
  console.log(`   Usuario 1 (${usuario1.address.slice(0,6)}...): ${interaccionesU1} interacciones`);
  console.log(`   Usuario 2 (${usuario2.address.slice(0,6)}...): ${interaccionesU2} interacciones`);
  console.log("");

  // === COMANDOS PARA INTERACCIÓN MANUAL ===
  console.log("🎉 ¡Demostración completada exitosamente!");
  console.log("");
  console.log("📍 Información del contrato desplegado:");
  console.log(`   Dirección: ${address}`);
  console.log(`   Red: Hardhat Local`);
  console.log("");
  console.log("💡 Comandos para interacción manual desde consola:");
  console.log("   npx hardhat console");
  console.log(`   > const c = await ethers.getContractAt("MiContrato", "${address}");`);
  console.log("   > await c.saludo();                    // Leer saludo");
  console.log("   > await c.contador();                  // Leer contador");
  console.log("   > await c.setSaludo('Nuevo saludo');   // Cambiar saludo");
  console.log("   > await c.setMensajePersonal('Mi mensaje'); // Mensaje personal");
  console.log("   > await c.getInfoUsuario('0x...');     // Info de usuario");
  console.log("   > await c.getInfoContrato();           // Info completa");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});