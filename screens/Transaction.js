import React, { Component } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ImageBackground,
  Image,
  Alert,
  ToastAndroid,
  KeyboardAvoidingView
} from "react-native";
import * as Permissions from "expo-permissions";
import { BarCodeScanner } from "expo-barcode-scanner";
import db from "../config";
import firebase from "firebase";

const bgImage = require("../assets/background2.png");
const appIcon = require("../assets/appIcon.png");
const appName = require("../assets/appName.png");

export default class TransactionScreen extends Component {
  constructor(props) {
    super(props);
    this.state = {
      bookId: "",
      studentId: "",
      domState: "normal",
      hasCameraPermissions: null,
      scanned: false,
      bookName: "",
      studentName: ""
    };
  }

  getCameraPermissions = async domState => {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);

    this.setState({
      /*status === "granted" es verdadero cuando el usuario da su permiso.
          status === "granted" es falso cuando el usuario no da su permiso.
        */
      hasCameraPermissions: status === "granted",
      domState: domState,
      scanned: false
    });
  };

  handleBarCodeScanned = async ({ type, data }) => {
    const { domState } = this.state;

    if (domState === "bookId") {
      this.setState({
        bookId: data,
        domState: "normal",
        scanned: true
      });
    } else if (domState === "studentId") {
      this.setState({
        studentId: data,
        domState: "normal",
        scanned: true
      });
    }
  };

  handleTransaction = async () => {
    var { bookId, studentId } = this.state;
    await this.getBookDetails(bookId);
    await this.getStudentDetails(studentId);

    var transactionType = await this.checkBookAvailability(bookId);

    if (!transactionType) {
      this.setState({ bookId: "", studentId: "" });
      // Solo para usuarios de Android.
      // ToastAndroid.show("El libro no existe en la base de datos de la biblioteca.", ToastAndroid.SHORT);
      Alert.alert("El libro no existe en la base de datos de la biblioteca.");
    } else if (transactionType === "issue") {
      var isEligible = await this.checkStudentEligibilityForBookIssue(
        studentId
      );

      if (isEligible) {
        var { bookName, studentName } = this.state;
        this.initiateBookIssue(bookId, studentId, bookName, studentName);
      }
      // Solo para usuarios de Android.
      // ToastAndroid.show("Se le envió el libro al alumno.", ToastAndroid.SHORT);
      Alert.alert("Se le envió el libro al alumno.");
    } else {
      var isEligible = await this.checkStudentEligibilityForBookReturn(
        bookId,
        studentId
      );

      if (isEligible) {
        var { bookName, studentName } = this.state;
        this.initiateBookReturn(bookId, studentId, bookName, studentName);
      }
      // Solo para usuarios de Android.
      // ToastAndroid.show("Se devolvió el libro a la biblioteca.", ToastAndroid.SHORT);
      Alert.alert("Se devolvió el libro a la biblioteca.");
    }
  };

  getBookDetails = bookId => {
    bookId = bookId.trim();
    db.collection("books")
      .where("book_id", "==", bookId)
      .get()
      .then(snapshot => {
        snapshot.docs.map(doc => {
          this.setState({
            bookName: doc.data().book_details.book_name
          });
        });
      });
  };

  getStudentDetails = studentId => {
    studentId = studentId.trim();
    db.collection("students")
      .where("student_id", "==", studentId)
      .get()
      .then(snapshot => {
        snapshot.docs.map(doc => {
          this.setState({
            studentName: doc.data().student_details.student_name
          });
        });
      });
  };

  checkBookAvailability = async bookId => {
    const bookRef = await db
      .collection("books")
      .where("book_id", "==", bookId)
      .get();

    var transactionType = "";
    if (bookRef.docs.length == 0) {
      transactionType = false;
    } else {
      bookRef.docs.map(doc => {
        //Si el libro está disponible, entonces el tipo de transacción será "issue".
        //Si no, será "return".
        transactionType = doc.data().is_book_available ? "issue" : "return";
      });
    }

    return transactionType;
  };

  checkStudentEligibilityForBookIssue = async studentId => {
    const studentRef = await db
      .collection("students")
      .where("student_id", "==", studentId)
      .get();

    var isStudentEligible = "";
    if (studentRef.docs.length == 0) {
      this.setState({
        bookId: "",
        studentId: ""
      });
      isStudentEligible = false;
      Alert.alert("El id del alumno no existe en la base de datos.");
    } else {
      studentRef.docs.map(doc => {
        if (doc.data().number_of_books_issued < 2) {
          isStudentEligible = true;
        } else {
          isStudentEligible = false;
          Alert.alert("El alumno ya tiene 2 libros.");
          this.setState({
            bookId: "",
            studentId: ""
          });
        }
      });
    }

    return isStudentEligible;
  };

  checkStudentEligibilityForBookReturn = async (bookId, studentId) => {
    const transactionRef = await db
      .collection("transactions")
      .where("book_id", "==", bookId)
      .limit(1)
      .get();
    var isStudentEligible = "";
    transactionRef.docs.map(doc => {
      var lastBookTransaction = doc.data();
      if (lastBookTransaction.student_id === studentId) {
        isStudentEligible = true;
      } else {
        isStudentEligible = false;
        Alert.alert("El alumno no pidió este libro.");
        this.setState({
          bookId: "",
          studentId: ""
        });
      }
    });
    return isStudentEligible;
  };

  initiateBookIssue = async (bookId, studentId, bookName, studentName) => {
    //Añadir una transacción.
    db.collection("transactions").add({
      student_id: studentId,
      student_name: studentName,
      book_id: bookId,
      book_name: bookName,
      date: firebase.firestore.Timestamp.now().toDate(),
      transaction_type: "issue"
    });
    //Cambiar el estatus del libro.
    db.collection("books")
      .doc(bookId)
      .update({
        is_book_available: false
      });
    //Cambiar el número de libros enviados al alumno.
    db.collection("students")
      .doc(studentId)
      .update({
        number_of_books_issued: firebase.firestore.FieldValue.increment(1)
      });

    // Actualizar el estado local.
    this.setState({
      bookId: "",
      studentId: ""
    });
  };

  initiateBookReturn = async (bookId, studentId, bookName, studentName) => {
    //Añadir una transacción.
    db.collection("transactions").add({
      student_id: studentId,
      student_name: studentName,
      book_id: bookId,
      book_name: bookName,
      date: firebase.firestore.Timestamp.now().toDate(),
      transaction_type: "return"
    });
    //Cambiar el estatus del libro.
    db.collection("books")
      .doc(bookId)
      .update({
        is_book_available: true
      });
    //Cambiar el número de libros enviados al alumno.
    db.collection("students")
      .doc(studentId)
      .update({
        number_of_books_issued: firebase.firestore.FieldValue.increment(-1)
      });

    // Actualizar el estado local.
    this.setState({
      bookId: "",
      studentId: ""
    });
  };

  render() {
    const { bookId, studentId, domState, scanned } = this.state;
    if (domState !== "normal") {
      return (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      );
    }
    return (
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <ImageBackground source={bgImage} style={styles.bgImage}>
          <View style={styles.upperContainer}>
            <Image source={appIcon} style={styles.appIcon} />
            <Image source={appName} style={styles.appName} />
          </View>
          <View style={styles.lowerContainer}>
            <View style={styles.textinputContainer}>
              <TextInput
                style={styles.textinput}
                placeholder={"Id del libro"}
                placeholderTextColor={"#FFFFFF"}
                value={bookId}
                onChangeText={text => this.setState({ bookId: text })}
              />
              <TouchableOpacity
                style={styles.scanbutton}
                onPress={() => this.getCameraPermissions("bookId")}
              >
                <Text style={styles.scanbuttonText}>Escanear</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.textinputContainer, { marginTop: 25 }]}>
              <TextInput
                style={styles.textinput}
                placeholder={"Id del alumno"}
                placeholderTextColor={"#FFFFFF"}
                value={studentId}
                onChangeText={text => this.setState({ studentId: text })}
              />
              <TouchableOpacity
                style={styles.scanbutton}
                onPress={() => this.getCameraPermissions("studentId")}
              >
                <Text style={styles.scanbuttonText}>Escanear</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.button, { marginTop: 25 }]}
              onPress={this.handleTransaction}
            >
              <Text style={styles.buttonText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
      </KeyboardAvoidingView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  bgImage: {
    flex: 1,
    resizeMode: "cover",
    justifyContent: "center"
  },
  upperContainer: {
    flex: 0.5,
    justifyContent: "center",
    alignItems: "center"
  },
  appIcon: {
    width: 200,
    height: 200,
    resizeMode: "contain",
    marginTop: 80
  },
  appName: {
    width: 80,
    height: 80,
    resizeMode: "contain"
  },
  lowerContainer: {
    flex: 0.5,
    alignItems: "center"
  },
  textinputContainer: {
    borderWidth: 2,
    borderRadius: 10,
    flexDirection: "row",
    backgroundColor: "#9DFD24",
    borderColor: "#FFFFFF"
  },
  textinput: {
    width: "57%",
    height: 50,
    padding: 10,
    borderColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 3,
    fontSize: 18,
    backgroundColor: "#5653D4",
    fontFamily: "Rajdhani_600SemiBold",
    color: "#FFFFFF"
  },
  scanbutton: {
    width: 100,
    height: 50,
    backgroundColor: "#9DFD24",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: "center",
    alignItems: "center"
  },
  scanbuttonText: {
    fontSize: 24,
    color: "#0A0101",
    fontFamily: "Rajdhani_600SemiBold"
  },
  button: {
    width: "43%",
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F48D20",
    borderRadius: 15
  },
  buttonText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontFamily: "Rajdhani_600SemiBold"
  }
});
