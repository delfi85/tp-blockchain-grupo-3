const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertiVax", function () {
  let certiVax;
  let owner;
  let vet;
  let feedOp;
  let auditor;
  let farmer;
  let buyer;
  let unauthorized;

  const contractHash = ethers.keccak256(ethers.toUtf8Bytes("CertiVax Contract v1.0"));
  const animalId1 = "VACA-001";

  beforeEach(async function () {
    [owner, vet, feedOp, auditor, farmer, buyer, unauthorized] = await ethers.getSigners();

    const CertiVax = await ethers.getContractFactory("CertiVax");
    certiVax = await CertiVax.deploy(contractHash);
    await certiVax.waitForDeployment();

    // Asignar roles
    await certiVax.assignRole(vet.address, 2); // Role.Vet
    await certiVax.assignRole(feedOp.address, 3); // Role.FeedOp
    await certiVax.assignRole(auditor.address, 4); // Role.Auditor
    await certiVax.assignRole(farmer.address, 5); // Role.Farmer
    await certiVax.assignRole(buyer.address, 6); // Role.Buyer
  });

  describe("Deployment", function () {
    it("Debe establecer el owner correctamente", async function () {
      expect(await certiVax.owner()).to.equal(owner.address);
    });

    it("Debe establecer el contractHash correctamente", async function () {
      expect(await certiVax.contractHash()).to.equal(contractHash);
    });

    it("Debe asignar rol Owner al deployer", async function () {
      expect(await certiVax.roles(owner.address)).to.equal(1); // Role.Owner
    });
  });

  describe("Gestión de Roles", function () {
    it("Debe permitir al owner asignar roles", async function () {
      const newAccount = unauthorized;
      await certiVax.assignRole(newAccount.address, 5); // Role.Farmer
      expect(await certiVax.getRole(newAccount.address)).to.equal(5);
    });

    it("Debe emitir evento al asignar rol", async function () {
      const newAccount = unauthorized;
      await expect(certiVax.assignRole(newAccount.address, 5))
        .to.emit(certiVax, "RoleAssigned")
        .withArgs(newAccount.address, 5);
    });

    it("No debe permitir asignar rol Owner", async function () {
      await expect(certiVax.assignRole(unauthorized.address, 1))
        .to.be.revertedWith("No se puede asignar rol Owner");
    });

    it("No debe permitir a no-owner asignar roles", async function () {
      await expect(certiVax.connect(vet).assignRole(unauthorized.address, 5))
        .to.be.revertedWith("Solo el owner puede ejecutar esta funcion");
    });

    it("Debe permitir revocar roles", async function () {
      await certiVax.revokeRole(vet.address);
      expect(await certiVax.getRole(vet.address)).to.equal(0); // Role.None
    });

    it("No debe permitir revocar rol del owner", async function () {
      await expect(certiVax.revokeRole(owner.address))
        .to.be.revertedWith("No se puede revocar rol del owner");
    });
  });

  describe("Gestión de Animales", function () {
    it("Debe permitir crear un animal", async function () {
      await expect(certiVax.connect(farmer).createAnimal(animalId1))
        .to.emit(certiVax, "AnimalCreated")
        .withArgs(animalId1, await ethers.provider.getBlock('latest').then(b => b.timestamp + 1));
    });

    it("Debe inicializar animal con valores correctos", async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);

      const [qualityScore, lastUpdated, currentState, isActive, totalRecords] =
        await certiVax.getAnimalInfo(animalId1);

      expect(qualityScore).to.equal(100);
      expect(currentState).to.equal(0); // DTEState.Created
      expect(isActive).to.be.true;
      expect(totalRecords).to.equal(0);
    });

    it("No debe permitir crear animal duplicado", async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);
      await expect(certiVax.connect(farmer).createAnimal(animalId1))
        .to.be.revertedWith("Animal ya existe");
    });

    it("No debe permitir ID vacío", async function () {
      await expect(certiVax.connect(farmer).createAnimal(""))
        .to.be.revertedWith("ID de animal invalido");
    });

    it("Solo Owner o Farmer pueden crear animales", async function () {
      await expect(certiVax.connect(vet).createAnimal(animalId1))
        .to.be.revertedWith("No tienes ninguno de los roles requeridos");
    });

    it("Debe permitir cerrar un animal", async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);

      await expect(certiVax.closeAnimal(animalId1))
        .to.emit(certiVax, "AnimalClosed")
        .withArgs(animalId1, 100);

      const [, , currentState, isActive] = await certiVax.getAnimalInfo(animalId1);
      expect(isActive).to.be.false;
      expect(currentState).to.equal(6); // DTEState.Closed
    });
  });

  describe("Gestión de Registros", function () {
    const certHash = ethers.keccak256(ethers.toUtf8Bytes("Certificado de vacunación"));
    const metaJson = '{"vaccine":"Aftosa","dose":"5ml"}';

    beforeEach(async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);
    });

    it("Debe permitir a Vet crear registro", async function () {
      await expect(certiVax.connect(vet).createRecord(
        animalId1,
        0, // EventType.Vaccination
        certHash,
        metaJson
      )).to.emit(certiVax, "RecordCreated");
    });

    it("Debe crear registro con datos correctos", async function () {
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);

      const record = await certiVax.getRecord(1);
      expect(record.id).to.equal(1);
      expect(record.eventType).to.equal(0);
      expect(record.animalId).to.equal(animalId1);
      expect(record.actor).to.equal(vet.address);
      expect(record.certHash).to.equal(certHash);
      expect(record.state).to.equal(0); // VerifState.Pending
      expect(record.dteState).to.equal(1); // DTEState.Registered
      expect(record.metaJson).to.equal(metaJson);
    });

    it("Debe actualizar estado del animal a PendingReview", async function () {
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);

      const [, , currentState] = await certiVax.getAnimalInfo(animalId1);
      expect(currentState).to.equal(2); // DTEState.PendingReview
    });

    it("Debe incrementar contador de registros", async function () {
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);
      expect(await certiVax.getTotalRecords()).to.equal(1);

      await certiVax.connect(feedOp).createRecord(animalId1, 2, certHash, metaJson);
      expect(await certiVax.getTotalRecords()).to.equal(2);
    });

    it("No debe permitir crear registro sin hash", async function () {
      await expect(certiVax.connect(vet).createRecord(
        animalId1, 0, ethers.ZeroHash, metaJson
      )).to.be.revertedWith("Hash del certificado requerido");
    });

    it("No debe permitir crear registro en animal inactivo", async function () {
      await certiVax.closeAnimal(animalId1);

      await expect(certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson))
        .to.be.revertedWith("Animal no esta activo");
    });

    it("Solo Vet o FeedOp pueden crear registros", async function () {
      await expect(certiVax.connect(farmer).createRecord(animalId1, 0, certHash, metaJson))
        .to.be.revertedWith("No tienes ninguno de los roles requeridos");
    });
  });

  describe("Verificación de Registros", function () {
    const certHash = ethers.keccak256(ethers.toUtf8Bytes("Certificado"));
    const metaJson = '{"data":"test"}';

    beforeEach(async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);
    });

    it("Debe permitir a Auditor verificar registro", async function () {
      await expect(certiVax.connect(auditor).verifyRecord(1))
        .to.emit(certiVax, "RecordVerified")
        .withArgs(1, auditor.address);
    });

    it("Debe actualizar estado del registro a Verified", async function () {
      await certiVax.connect(auditor).verifyRecord(1);

      const record = await certiVax.getRecord(1);
      expect(record.state).to.equal(1); // VerifState.Verified
      expect(record.dteState).to.equal(3); // DTEState.Verified
    });

    it("Debe actualizar estado del animal a InTracking", async function () {
      await certiVax.connect(auditor).verifyRecord(1);

      const [, , currentState] = await certiVax.getAnimalInfo(animalId1);
      expect(currentState).to.equal(4); // DTEState.InTracking
    });

    it("Debe mantener qualityScore en 100 si ya está al máximo", async function () {
      await certiVax.connect(auditor).verifyRecord(1);

      const [qualityScore] = await certiVax.getAnimalInfo(animalId1);
      expect(qualityScore).to.equal(100);
    });

    it("Debe aumentar qualityScore si está por debajo de 100", async function () {
      // Primero reducir el score revocando un registro
      await certiVax.connect(vet).createRecord(animalId1, 1, certHash, metaJson);
      await certiVax.connect(auditor).revokeRecord(2, "Error de prueba");

      let [qualityScore] = await certiVax.getAnimalInfo(animalId1);
      expect(qualityScore).to.equal(90);

      // Ahora verificar un registro
      await certiVax.connect(auditor).verifyRecord(1);
      [qualityScore] = await certiVax.getAnimalInfo(animalId1);
      expect(qualityScore).to.equal(95);
    });

    it("No debe permitir verificar registro ya procesado", async function () {
      await certiVax.connect(auditor).verifyRecord(1);

      await expect(certiVax.connect(auditor).verifyRecord(1))
        .to.be.revertedWith("Registro ya fue procesado");
    });

    it("Solo Auditor puede verificar registros", async function () {
      await expect(certiVax.connect(vet).verifyRecord(1))
        .to.be.revertedWith("No tienes el rol requerido");
    });
  });

  describe("Revocación de Registros", function () {
    const certHash = ethers.keccak256(ethers.toUtf8Bytes("Certificado"));
    const metaJson = '{"data":"test"}';
    const reason = "Datos inconsistentes";

    beforeEach(async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);
    });

    it("Debe permitir a Auditor revocar registro", async function () {
      await expect(certiVax.connect(auditor).revokeRecord(1, reason))
        .to.emit(certiVax, "RecordRevoked")
        .withArgs(1, auditor.address, reason);
    });

    it("Debe actualizar estado del registro a Revoked", async function () {
      await certiVax.connect(auditor).revokeRecord(1, reason);

      const record = await certiVax.getRecord(1);
      expect(record.state).to.equal(2); // VerifState.Revoked
      expect(record.dteState).to.equal(7); // DTEState.Rejected
    });

    it("Debe reducir qualityScore en 10 puntos", async function () {
      await certiVax.connect(auditor).revokeRecord(1, reason);

      const [qualityScore] = await certiVax.getAnimalInfo(animalId1);
      expect(qualityScore).to.equal(90);
    });

    it("No debe reducir qualityScore por debajo de 0", async function () {
      // Crear y revocar múltiples registros
      for (let i = 0; i < 12; i++) {
        await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);
        await certiVax.connect(auditor).revokeRecord(i + 1, reason);
      }

      const [qualityScore] = await certiVax.getAnimalInfo(animalId1);
      expect(qualityScore).to.equal(0);
    });

    it("No debe permitir revocar registro ya revocado", async function () {
      await certiVax.connect(auditor).revokeRecord(1, reason);

      await expect(certiVax.connect(auditor).revokeRecord(1, reason))
        .to.be.revertedWith("Registro ya fue revocado");
    });

    it("Solo Auditor puede revocar registros", async function () {
      await expect(certiVax.connect(vet).revokeRecord(1, reason))
        .to.be.revertedWith("No tienes el rol requerido");
    });
  });

  describe("Actualización de Estado de Registros", function () {
    const certHash = ethers.keccak256(ethers.toUtf8Bytes("Certificado"));
    const metaJson = '{"data":"test"}';

    beforeEach(async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);
      await certiVax.connect(auditor).verifyRecord(1);
    });

    it("Debe permitir actualizar estado a Updated", async function () {
      await expect(certiVax.updateRecordState(1, 5)) // DTEState.Updated
        .to.emit(certiVax, "RecordUpdated")
        .withArgs(1, 5);

      const record = await certiVax.getRecord(1);
      expect(record.dteState).to.equal(5);
    });

    it("No debe permitir actualizar registro no verificado", async function () {
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);

      await expect(certiVax.updateRecordState(2, 5))
        .to.be.revertedWith("Solo registros verificados pueden actualizarse");
    });

    it("Solo Auditor u Owner pueden actualizar estado", async function () {
      await expect(certiVax.connect(vet).updateRecordState(1, 5))
        .to.be.revertedWith("No tienes ninguno de los roles requeridos");
    });
  });

  describe("Consultas", function () {
    const certHash = ethers.keccak256(ethers.toUtf8Bytes("Certificado"));
    const metaJson = '{"data":"test"}';

    beforeEach(async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);
      await certiVax.connect(feedOp).createRecord(animalId1, 2, certHash, metaJson);
    });

    it("Debe retornar todos los IDs de registros de un animal", async function () {
      const recordIds = await certiVax.getAnimalRecords(animalId1);
      expect(recordIds.length).to.equal(2);
      expect(recordIds[0]).to.equal(1);
      expect(recordIds[1]).to.equal(2);
    });

    it("Debe retornar información completa del animal", async function () {
      const [qualityScore, lastUpdated, currentState, isActive, totalRecords] =
        await certiVax.getAnimalInfo(animalId1);

      expect(qualityScore).to.equal(100);
      expect(currentState).to.equal(2); // DTEState.PendingReview
      expect(isActive).to.be.true;
      expect(totalRecords).to.equal(2);
    });

    it("Debe verificar hash de certificado correctamente", async function () {
      expect(await certiVax.verifyRecordHash(1, certHash)).to.be.true;

      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("Wrong"));
      expect(await certiVax.verifyRecordHash(1, wrongHash)).to.be.false;
    });

    it("Debe fallar al consultar animal inexistente", async function () {
      await expect(certiVax.getAnimalInfo("VACA-999"))
        .to.be.revertedWith("Animal no existe");
    });

    it("Debe fallar al consultar registro inexistente", async function () {
      await expect(certiVax.getRecord(999))
        .to.be.revertedWith("Registro no existe");
    });
  });

  describe("Flujo Completo DTE", function () {
    const certHash = ethers.keccak256(ethers.toUtf8Bytes("Certificado Vacunación"));
    const metaJson = '{"vaccine":"Aftosa","dose":"5ml","batch":"A123"}';

    it("Debe seguir flujo completo: Created -> Registered -> Verified -> InTracking", async function () {
      // 1. Created
      await certiVax.connect(farmer).createAnimal(animalId1);
      let [, , currentState] = await certiVax.getAnimalInfo(animalId1);
      expect(currentState).to.equal(0); // Created

      // 2. Registered -> PendingReview
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);
      [, , currentState] = await certiVax.getAnimalInfo(animalId1);
      expect(currentState).to.equal(2); // PendingReview

      // 3. Verified -> InTracking
      await certiVax.connect(auditor).verifyRecord(1);
      [, , currentState] = await certiVax.getAnimalInfo(animalId1);
      expect(currentState).to.equal(4); // InTracking

      // 4. Updated
      await certiVax.updateRecordState(1, 5); // Updated
      [, , currentState] = await certiVax.getAnimalInfo(animalId1);
      expect(currentState).to.equal(5); // Updated

      // 5. Closed
      await certiVax.closeAnimal(animalId1);
      [, , currentState, isActive] = await certiVax.getAnimalInfo(animalId1);
      expect(currentState).to.equal(6); // Closed
      expect(isActive).to.be.false;
    });

    it("Debe manejar rechazo en flujo", async function () {
      await certiVax.connect(farmer).createAnimal(animalId1);
      await certiVax.connect(vet).createRecord(animalId1, 0, certHash, metaJson);

      // Rechazar
      await certiVax.connect(auditor).revokeRecord(1, "Documentación inválida");

      const [qualityScore, , currentState] = await certiVax.getAnimalInfo(animalId1);
      expect(currentState).to.equal(7); // Rejected
      expect(qualityScore).to.equal(90);
    });
  });
});