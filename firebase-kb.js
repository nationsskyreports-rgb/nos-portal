/* ═══════════════════════════════════════════════════
   NOS PORTAL — firebase-kb.js
   Firebase connection للـ Knowledge Base
   ═══════════════════════════════════════════════════
   ⚠️ ملاحظة: الملف ده type="module" 
   يعني لازم تحطه في الـ HTML كـ:
   <script type="module" src="firebase-kb.js"></script>
   ═══════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/* ─── Firebase Config ─── */
/* لو عايز تغير المشروع، عدّل البيانات هنا */
const firebaseConfig = {
  apiKey:    "AIzaSyB_SM6Igr-oP2kgGpyXG5K03uaL69n9qCs",
  authDomain:"nations-of-sky.firebaseapp.com",
  projectId: "nations-of-sky"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);


/* ─── Load All KB Sections ─── */
/* بتجيب كل الـ sections من Firestore مرتبة بالرقم */
window.loadKBFromFirestore = async function() {
  try {
    const snapshot = await getDocs(collection(db, 'KnowledgeBase'));
    const docs = snapshot.docs.map(doc => {
      const id    = doc.id;
      const match = id.match(/^(\d+)-(.+)$/);
      const order = match ? parseInt(match[1]) : 999;
      const title = match ? match[2].replace(/-/g, ' ') : id;
      return {
        id:      id,
        title:   title,
        content: doc.data().content || '',
        order:   order
      };
    });
    docs.sort((a, b) => a.order - b.order);
    return docs;
  } catch(e) {
    console.log('Firestore error:', e);
    return [];
  }
};


/* ─── Save KB Section ─── */
/* بتحفظ التعديلات على section معين */
window.saveKBSection = async function(docId, content) {
  try {
    await updateDoc(doc(db, 'KnowledgeBase', docId), { content: content });
    return true;
  } catch(e) {
    console.log('Save error:', e);
    return false;
  }
};
