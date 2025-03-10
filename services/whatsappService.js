const { client, clientReady } = require('../whatsapp/wabot');
const { verifiedNumbers } = require("../whatsapp/verifiedNumbersStore");


exports.isUserInGroup = async (whatsappNumber, groupId) => {
    try {
        console.log("🔍 Status bot saat ini:", clientReady ? "✅ Siap" : "⏳ Belum siap");

        if (!clientReady) {
            console.log("⚠️ Bot belum siap, menunggu koneksi...");
            return null;
        }

        // Pastikan format group ID benar
        groupId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;

        console.log(`🔎 Mengecek anggota grup ${groupId}...`);
        
        const group = await client.getChatById(groupId);
        if (!group) {
            console.log(`❌ Grup ${groupId} tidak ditemukan atau bot bukan anggota.`);
            return false;
        }

        const participants = await group.getParticipants(); // Ambil semua anggota grup
        const isMember = participants.some(participant => participant.id._serialized === `${whatsappNumber}@c.us`);

        console.log(`🔍 User ${whatsappNumber} ${isMember ? "✅ terdeteksi dalam grup" : "❌ tidak ditemukan dalam grup"}`);

        return isMember;
    } catch (error) {
        console.error("❌ Error verifying group membership:", error);
        return false;
    }
};


exports.validateGroupIdFormat = (groupId) => {
    return groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
};

// Fungsi untuk menampilkan daftar anggota dalam grup
exports.logGroupParticipants = async function (groupId) {
    if (!clientReady) {
        console.log("⚠️ Bot belum siap, tidak dapat mengambil peserta grup.");
        return;
    }
  
    try {
        console.log(`🔎 Mengambil daftar peserta grup: ${groupId}`);
        const chat = await client.getChatById(groupId);
        if (!chat || !chat.participants) {
            console.log("⚠️ Grup tidak ditemukan atau tidak memiliki peserta.");
            return;
        }
  
        console.log(`✅ Grup ditemukan: ${groupId}. Menampilkan peserta...`);
        chat.participants.forEach((participant) => {
            console.log(`👤 ${participant.id.user}@c.us`);
        });
    } catch (error) {
        console.error("❌ Gagal mengambil daftar peserta grup:", error);
    }
  };

  exports.isVerified = (whatsappNumber) => {
    console.log("Memeriksa nomor:", whatsappNumber);
    console.log("Verified Numbers saat ini:", Array.from(verifiedNumbers || []));

    if (!verifiedNumbers || !(verifiedNumbers instanceof Set)) {
        console.error("verifiedNumbers tidak tersedia atau bukan Set!");
        return false;
    }
    
    return verifiedNumbers.has(whatsappNumber);
};
